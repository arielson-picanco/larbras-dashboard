// ============================================================
// MÓDULO 3 — Modal de importação  (v4 — substituir/adicionar)
// ============================================================

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, ClipboardPaste, CheckCircle2, AlertCircle, Info, RefreshCw, PlusCircle } from 'lucide-react'
import { useDashboardStore }   from '@/store/useDashboardStore'
import { parseXLSXFile, parseCSVText, autoDetectMapping, mapToSaleRows, buildMappingReport } from '@/services/parser'
import { saveRows, loadRows }  from '@/services/db'
import type { SaleRow }        from '@/types'

type TabId   = 'file' | 'paste'
type Mode    = 'replace' | 'append'
type Status  = { type: 'idle' | 'loading' | 'success' | 'error'; message: string; detail?: string[] }

export function ImportModal() {
  const { importModalOpen, closeImportModal, setAllRows, setLoading, columnDefs, setColumnDefs, allRows } = useDashboardStore()

  const [tab,      setTab]      = useState<TabId>('file')
  const [mode,     setMode]     = useState<Mode>('replace')
  const [csvText,  setCsvText]  = useState('')
  const [dragging, setDragging] = useState(false)
  const [status,   setStatus]   = useState<Status>({ type: 'idle', message: '' })
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const processRaw = useCallback(async (
    headers: string[],
    rows: Record<string, unknown>[]
  ) => {
    setStatus({ type: 'loading', message: `Detectando colunas…` })

    const freshDefs   = columnDefs.map((d) => ({ ...d, mapTo: '' }))
    const updatedDefs = autoDetectMapping(headers, freshDefs)
    setColumnDefs(updatedDefs)
    const report = buildMappingReport(updatedDefs)
    const mappingLines = report.mapped.map((m) => `${m.label} → "${m.column}"`)
    if (report.unmapped.length) mappingLines.push(`Não detectados: ${report.unmapped.map((u) => u.label).join(', ')}`)

    try {
      setStatus({ type: 'loading', message: `Processando ${rows.length.toLocaleString('pt-BR')} linhas…` })
      const newRows = mapToSaleRows(rows as never, updatedDefs)
      if (!newRows.length) throw new Error(`Nenhuma linha com valor > 0. Coluna detectada: "${updatedDefs.find((d) => d.key === 'valor')?.mapTo || 'NENHUMA'}"`)

      setStatus({ type: 'loading', message: 'Salvando…' })

      let finalRows: SaleRow[]
      if (mode === 'append' && allRows.length > 0) {
        // Append: merge with existing using SEMANTIC dedup key
        // Uses client + date + value + product (normalized) — resilient to:
        //   - Column order differences between files
        //   - Minor spelling variations (trim, lowercase)
        //   - Bairro name abbreviations (Santo Antonio vs STO ANTONIO)
        const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const semanticKey = (r: import('@/types').SaleRow) =>
          [
            norm(r._cliente),
            r._date ? r._date.toISOString().slice(0, 10) : 'nodate',
            r._val.toFixed(2),
            norm(r._produto),
          ].join('|')

        const existing = await loadRows()
        const existingKeys = new Set(existing.map(semanticKey))
        const deduped = newRows.filter((r) => !existingKeys.has(semanticKey(r)))
        finalRows = [...existing, ...deduped]
        const skipped = newRows.length - deduped.length
        mappingLines.push(`Modo: Adicionado ${deduped.length.toLocaleString('pt-BR')} novos registros${skipped > 0 ? ` (${skipped} duplicatas ignoradas)` : ''}`)
      } else {
        finalRows = newRows
        mappingLines.push(`Modo: Substituição total — ${finalRows.length.toLocaleString('pt-BR')} registros`)
      }

      await saveRows(finalRows)
      setAllRows(finalRows)
      setLoading(false)
      setStatus({ type: 'success', message: `${finalRows.length.toLocaleString('pt-BR')} registros carregados`, detail: mappingLines })
      setTimeout(() => closeImportModal(), 2200)
    } catch (err) {
      setLoading(false)
      setStatus({ type: 'error', message: String(err), detail: mappingLines })
    }
  }, [columnDefs, setColumnDefs, setAllRows, setLoading, closeImportModal, mode, allRows])

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setStatus({ type: 'loading', message: 'Lendo arquivo…' })
    setLoading(true)
    try {
      const { headers, rows } = await parseXLSXFile(file)
      await processRaw(headers, rows)
    } catch (err) {
      setLoading(false)
      setStatus({ type: 'error', message: String(err) })
    }
  }

  const handlePaste = async () => {
    if (!csvText.trim()) return
    setStatus({ type: 'loading', message: 'Processando CSV…' })
    setLoading(true)
    try {
      const { headers, rows } = parseCSVText(csvText)
      await processRaw(headers, rows)
    } catch (err) {
      setLoading(false)
      setStatus({ type: 'error', message: String(err) })
    }
  }

  if (!importModalOpen) return null

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && closeImportModal()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', backdropFilter:'blur(4px)', animation:'fadeIn .15s ease' }}
    >
      <div style={{ background:'var(--bg-modal)', border:'1px solid var(--border-default)', borderRadius:14, width:'100%', maxWidth:520, boxShadow:'var(--shadow-modal)', animation:'slideInRight .2s ease', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Importar dados</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>XLSX, XLS ou CSV — colunas detectadas automaticamente</div>
          </div>
          <button onClick={closeImportModal} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding:4, borderRadius:6, display:'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Replace / Append toggle — only when existing data */}
        {allRows.length > 0 && (
          <div style={{ padding:'10px 1.25rem', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-card2)' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:8 }}>
              O que deseja fazer com os dados existentes?
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => setMode('replace')}
                style={{ flex:1, padding:'8px 12px', borderRadius:8, border:`1px solid ${mode==='replace'?'var(--accent)':'var(--border-default)'}`, background: mode==='replace'?'var(--accent)':'transparent', color: mode==='replace'?'#0b0d18':'var(--text-primary)', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'all .15s' }}
              >
                <RefreshCw size={13} />
                Substituir Dados
              </button>
              <button
                onClick={() => setMode('append')}
                style={{ flex:1, padding:'8px 12px', borderRadius:8, border:`1px solid ${mode==='append'?'var(--info)':'var(--border-default)'}`, background: mode==='append'?'rgba(91,141,238,.12)':'transparent', color: mode==='append'?'var(--info)':'var(--text-primary)', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'all .15s' }}
              >
                <PlusCircle size={13} />
                Adicionar aos Existentes
              </button>
            </div>
            {mode === 'append' && (
              <div style={{ marginTop:7, fontSize:10, color:'var(--info)', display:'flex', alignItems:'center', gap:5 }}>
                <Info size={10} />
                Registros duplicados serão ignorados automaticamente
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)' }}>
          {([['file','Arquivo',FileSpreadsheet],['paste','Colar CSV',ClipboardPaste]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex:1, background:'none', border:'none', borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`, color: tab===id?'var(--accent)':'var(--text-secondary)', fontFamily:'inherit', fontSize:12, fontWeight: tab===id?600:400, padding:'10px 0 9px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s' }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding:'1.25rem' }}>
          {tab === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${dragging?'var(--accent)':'var(--border-default)'}`, borderRadius:10, padding:'2.5rem 1rem', textAlign:'center', cursor:'pointer', background: dragging?'var(--accent-muted)':'var(--bg-card2)', transition:'all .15s' }}
            >
              <Upload size={24} style={{ color: dragging?'var(--accent)':'var(--text-secondary)', display:'block', margin:'0 auto 10px' }} />
              <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500, marginBottom:4 }}>
                {fileName || 'Arraste e solte o arquivo aqui'}
              </div>
              <div style={{ fontSize:11, color:'var(--text-secondary)' }}>ou clique para selecionar — .xlsx, .xls, .csv</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
                onChange={(e) => { const f=e.target.files?.[0]; if(f) handleFile(f) }}
              />
            </div>
          ) : (
            <>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
                placeholder={'data;cliente;produto;valor\n01/01/2024;João;Mesa;1500,00'}
                className="input"
                style={{ width:'100%', height:140, resize:'vertical', fontFamily:"'IBM Plex Mono'", fontSize:11, lineHeight:1.6 }}
              />
              <button onClick={handlePaste} disabled={!csvText.trim()||status.type==='loading'}
                style={{ marginTop:10, width:'100%', background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'10px 0', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', opacity: !csvText.trim()||status.type==='loading'?0.6:1 }}
              >
                Processar CSV
              </button>
            </>
          )}

          {/* Status */}
          {status.type !== 'idle' && (
            <div style={{ marginTop:12, borderRadius:8, background: status.type==='error'?'rgba(240,107,107,.1)':status.type==='success'?'rgba(34,211,160,.08)':'var(--bg-card2)', border:`1px solid ${status.type==='error'?'rgba(240,107,107,.25)':status.type==='success'?'rgba(34,211,160,.25)':'var(--border-subtle)'}`, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', fontSize:12, display:'flex', alignItems:'flex-start', gap:8, color: status.type==='error'?'var(--danger)':status.type==='success'?'var(--success)':'var(--text-secondary)' }}>
                {status.type==='loading' && <div style={{ width:14, height:14, flexShrink:0, marginTop:1, border:'2px solid var(--text-tertiary)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />}
                {status.type==='success' && <CheckCircle2 size={14} style={{ flexShrink:0, marginTop:1 }} />}
                {status.type==='error'   && <AlertCircle  size={14} style={{ flexShrink:0, marginTop:1 }} />}
                <span style={{ lineHeight:1.5 }}>{status.message}</span>
              </div>
              {status.detail && status.detail.length > 0 && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'8px 14px 10px', display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
                    <Info size={10} /> Mapeamento detectado
                  </div>
                  {status.detail.map((line, i) => (
                    <div key={i} style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", color: line.startsWith('Não')||line.startsWith('Modo')?'var(--info)':'var(--text-secondary)', lineHeight:1.5 }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
