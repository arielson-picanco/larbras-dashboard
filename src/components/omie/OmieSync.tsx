// ============================================================
// components/omie/OmieSync.tsx — Painel de integração Omiê
// CORREÇÃO: auto-refresh do store após sync completar
// ============================================================
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { apiFetch } from '@/services/api'
import { useDashboardStore } from '@/store/useDashboardStore'
import {
  RefreshCw, Wifi, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Database, Calendar, AlertTriangle,
  Play, RotateCcw, Info, BarChart2,
} from 'lucide-react'

interface SyncState {
  last_synced_date: string | null
  updated_at:       string | null
}

interface SyncLog {
  id:             number
  status:         'running' | 'success' | 'error'
  started_at:     string
  finished_at:    string | null
  records_synced: number | null
  date_from:      string | null
  date_to:        string | null
  error_msg:      string | null
}

interface TestResult {
  ok:                     boolean
  error?:                 string
  total_pedidos_todos?:   number
  total_paginas?:         number
  etapas_encontradas?:    Record<string, number>
  etapas_configuradas?:   string[]
  aviso_configuracao?:    string | null
  sample_raw?:            Record<string, unknown>
  sample_fields?:         Record<string, string[]>
  sample_converted?:      Record<string, unknown>[]
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateOnly(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function friendlyError(raw: string): string {
  if (raw.includes('502') || raw.includes('Backend')) return 'Backend offline. Inicie com: cd backend && npm run dev'
  if (raw.includes('Rota não encontrada'))              return 'Rota não encontrada — reinicie o backend.'
  if (raw.includes('401') || raw.includes('Token'))     return 'Sessão expirada. Faça login novamente.'
  if (raw.includes('OMIE_APP_KEY') || raw.includes('appKey')) return 'Credenciais do Omiê não configuradas. Verifique backend/.env'
  return raw
}

function StatusBadge({ status }: { status: SyncLog['status'] }) {
  const map = {
    running: { icon: <Clock size={12} />,       label: 'Executando', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
    success: { icon: <CheckCircle size={12} />,  label: 'Sucesso',    color: '#4ade80', bg: 'rgba(74,222,128,.12)' },
    error:   { icon: <XCircle size={12} />,      label: 'Erro',       color: '#f06b6b', bg: 'rgba(240,107,107,.12)' },
  }
  const s = map[status] || map.error
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700, color:s.color, background:s.bg }}>
      {s.icon} {s.label}
    </span>
  )
}

export function OmieSync() {
  const { refreshFromAPI, allRows } = useDashboardStore()

  const [state,         setState]         = useState<SyncState | null>(null)
  const [logs,          setLogs]          = useState<SyncLog[]>([])
  const [loading,       setLoading]       = useState(true)
  const [running,       setRunning]       = useState(false)
  const [testResult,    setTestResult]    = useState<TestResult | null>(null)
  const [testLoading,   setTestLoading]   = useState(false)
  const [expandLog,     setExpandLog]     = useState<number | null>(null)
  const [expandRaw,     setExpandRaw]     = useState(false)
  const [rangeFrom,     setRangeFrom]     = useState('')
  const [rangeTo,       setRangeTo]       = useState(() => new Date().toISOString().slice(0,10))
  const [rangeRunning,  setRangeRunning]  = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  // Controla se o dashboard foi atualizado após o último sync
  const [needsRefresh,  setNeedsRefresh]  = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)

  // Ref para detectar transição running → success nos logs
  const prevLogsRef = useRef<SyncLog[]>([])

  // ── Buscar status ─────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ state: SyncState | null; logs: SyncLog[] }>('/sync/status')
      setState(data.state)
      const newLogs = data.logs || []
      setLogs(newLogs)
      setBackendOnline(true)

      // Detecta transição running → success: marca que o dashboard precisa atualizar
      const prevRunning = prevLogsRef.current.find(l => l.status === 'running')
      const nowSuccess  = newLogs.find(l => l.id === prevRunning?.id && l.status === 'success')
      if (nowSuccess) {
        setNeedsRefresh(true)
      }
      prevLogsRef.current = newLogs
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('502') || msg.includes('Backend')) setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const iv = setInterval(fetchStatus, 6000)
    return () => clearInterval(iv)
  }, [fetchStatus])

  // ── Auto-refresh: quando sync termina com sucesso, atualiza o dashboard ──
  useEffect(() => {
    if (!needsRefresh) return
    let cancelled = false
    const autoRefresh = async () => {
      setRefreshing(true)
      try {
        await refreshFromAPI()
        if (!cancelled) {
          setNeedsRefresh(false)
          showToast('Dashboard atualizado com os dados do sync!')
        }
      } catch {
        if (!cancelled) showToast('Sync concluído. Clique em "Atualizar Dashboard" para ver os dados.', false)
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    autoRefresh()
    return () => { cancelled = true }
  }, [needsRefresh, refreshFromAPI])

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg: ok ? msg : friendlyError(msg), ok })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Refresh manual do dashboard ───────────────────────────────────────────
  async function handleRefreshDashboard() {
    setRefreshing(true)
    try {
      await refreshFromAPI()
      setNeedsRefresh(false)
      showToast('Dashboard atualizado!')
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    } finally {
      setRefreshing(false)
    }
  }

  // ── Sync incremental ──────────────────────────────────────────────────────
  async function handleRunSync() {
    if (backendOnline === false) {
      showToast('Backend offline. Inicie com: cd backend && npm run dev', false)
      return
    }
    setRunning(true)
    try {
      await apiFetch('/sync/run', { method: 'POST' })
      showToast('Sincronização iniciada! O dashboard será atualizado automaticamente ao concluir.')
      setTimeout(fetchStatus, 2000)
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    } finally {
      setRunning(false)
    }
  }

  // ── Sync de período ───────────────────────────────────────────────────────
  async function handleRangeSync() {
    if (!rangeFrom || !rangeTo) return showToast('Informe as duas datas.', false)
    setRangeRunning(true)
    try {
      await apiFetch('/sync/run-range', { method: 'POST', body: JSON.stringify({ dateFrom: rangeFrom, dateTo: rangeTo }) })
      showToast(`Sync de ${fmtDateOnly(rangeFrom)} a ${fmtDateOnly(rangeTo)} iniciado!`)
      setTimeout(fetchStatus, 2000)
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    } finally {
      setRangeRunning(false)
    }
  }

  // ── Testar conexão ────────────────────────────────────────────────────────
  async function handleTest() {
    setTestLoading(true)
    setTestResult(null)
    setExpandRaw(false)
    try {
      const result = await apiFetch('/sync/test')
      setTestResult(result)
    } catch (e: unknown) {
      setTestResult({ ok: false, error: friendlyError((e as Error).message) })
    } finally {
      setTestLoading(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  async function handleReset() {
    if (!confirm('Isso vai fazer o próximo sync buscar os últimos 90 dias do Omiê. Confirmar?')) return
    try {
      await apiFetch('/sync/reset', { method: 'DELETE' })
      showToast('Estado resetado. O próximo sync buscará 90 dias.')
      fetchStatus()
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    }
  }

  // ── Estilos ───────────────────────────────────────────────────────────────
  const cardStyle: CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem',
  }
  const labelStyle: CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.7px', color: 'var(--text-secondary)',
    marginBottom: 4, display: 'block',
  }
  const inputStyle: CSSProperties = {
    background: 'var(--bg-card2)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, padding: '8px 12px', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', width: '100%',
  }
  const btnPrimary: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'var(--accent)', border: 'none', borderRadius: 9,
    padding: '9px 18px', fontSize: 13, fontWeight: 700,
    color: '#0b0d18', cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnSecondary: CSSProperties = {
    ...btnPrimary, background: 'var(--bg-card2)',
    color: 'var(--text-primary)', border: '1px solid var(--border-subtle)',
  }

  const runningLog = logs.find(l => l.status === 'running')

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 0' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:20, right:24, zIndex:9999,
          background: toast.ok ? '#4ade80' : '#f06b6b',
          color: toast.ok ? '#0b0d18' : '#fff',
          padding:'10px 18px', borderRadius:10, fontSize:13, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,.3)', maxWidth:420, lineHeight:1.5,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Banner de backend offline */}
      {backendOnline === false && (
        <div style={{
          padding:'12px 18px', borderRadius:10, marginBottom:'1.25rem',
          background:'rgba(240,107,107,.1)', border:'1px solid rgba(240,107,107,.3)',
          display:'flex', alignItems:'center', gap:10, fontSize:13,
        }}>
          <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink:0 }} />
          <div>
            <strong style={{ color:'var(--danger)' }}>Backend offline.</strong>{' '}
            Execute:{' '}
            <code style={{ background:'var(--bg-card2)', padding:'2px 7px', borderRadius:5, fontSize:12 }}>
              cd backend &amp;&amp; npm run dev
            </code>
          </div>
        </div>
      )}

      {/* Banner: dados prontos para visualizar */}
      {needsRefresh && !refreshing && (
        <div style={{
          padding:'12px 18px', borderRadius:10, marginBottom:'1.25rem',
          background:'rgba(74,222,128,.08)', border:'1px solid rgba(74,222,128,.3)',
          display:'flex', alignItems:'center', gap:12, fontSize:13,
        }}>
          <CheckCircle size={16} color="#4ade80" style={{ flexShrink:0 }} />
          <span style={{ flex:1, color:'var(--text-primary)' }}>
            Sync concluído. Clique para atualizar o dashboard.
          </span>
          <button onClick={handleRefreshDashboard} style={{ ...btnPrimary, padding:'7px 16px', fontSize:12 }}>
            <BarChart2 size={13} /> Atualizar Dashboard
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom:'1.5rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>
            Integração Omiê ERP
          </h2>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:6 }}>
            Sync automático diariamente às 06:00 (Manaus). Somente pedidos faturados são importados.
          </p>
        </div>
        {/* Refresh manual sempre disponível */}
        <button
          onClick={handleRefreshDashboard}
          disabled={refreshing}
          style={{ ...btnSecondary, opacity: refreshing ? .6 : 1 }}
        >
          <BarChart2 size={14} />
          {refreshing ? 'Atualizando…' : `Atualizar Dashboard${allRows.length ? ` (${allRows.length.toLocaleString('pt-BR')} reg.)` : ''}`}
        </button>
      </div>

      {/* Status cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:'1.5rem' }}>
        {[
          {
            icon:  <Database size={18} color="var(--accent)" />,
            label: 'Último sync',
            value: loading ? '…' : fmtDateOnly(state?.last_synced_date),
          },
          {
            icon:  <Clock size={18} color="var(--accent)" />,
            label: 'Atualizado em',
            value: loading ? '…' : fmtDate(state?.updated_at),
          },
          {
            icon: backendOnline === false
              ? <XCircle size={18} color="var(--danger)" />
              : runningLog
                ? <RefreshCw size={18} color="#f5a623" style={{ animation:'spin 1s linear infinite' }} />
                : <CheckCircle size={18} color="#4ade80" />,
            label: 'Backend',
            value: backendOnline === false ? 'Offline' : runningLog ? 'Sincronizando…' : 'Online',
          },
        ].map(({ icon, label, value }, i) => (
          <div key={i} style={{ ...cardStyle, marginBottom:0, display:'flex', gap:12, alignItems:'flex-start' }}>
            <div style={{ marginTop:2 }}>{icon}</div>
            <div>
              <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginTop:4 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div style={cardStyle}>
        <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 1rem', color:'var(--text-primary)' }}>
          Ações de Sincronização
        </h3>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:'1.25rem' }}>
          <button onClick={handleRunSync} disabled={running || !!runningLog || backendOnline === false}
            style={{ ...btnPrimary, opacity:(running || runningLog || backendOnline === false) ? .5 : 1 }}>
            <Play size={14} />
            {running ? 'Iniciando…' : 'Sync Incremental'}
          </button>
          <button onClick={handleTest} disabled={testLoading || backendOnline === false}
            style={{ ...btnSecondary, opacity:(testLoading || backendOnline === false) ? .5 : 1 }}>
            <Wifi size={14} />
            {testLoading ? 'Testando…' : 'Testar Conexão'}
          </button>
          <button onClick={handleReset} disabled={backendOnline === false}
            style={{ ...btnSecondary, opacity: backendOnline === false ? .5 : 1 }}>
            <RotateCcw size={14} /> Resetar Estado
          </button>
        </div>

        {/* Sync por período */}
        <div style={{ background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'1rem' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10 }}>
            SYNC POR PERÍODO CUSTOMIZADO
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={labelStyle}>Data início</label>
              <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              <label style={labelStyle}>Data fim</label>
              <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={handleRangeSync} disabled={rangeRunning || !!runningLog || backendOnline === false}
              style={{ ...btnPrimary, opacity:(rangeRunning || runningLog || backendOnline === false) ? .5 : 1 }}>
              <Calendar size={14} />
              {rangeRunning ? 'Iniciando…' : 'Sincronizar Período'}
            </button>
          </div>
          <p style={{ fontSize:11, color:'var(--text-tertiary)', margin:'8px 0 0' }}>
            Dados existentes serão atualizados (upsert). Apenas pedidos faturados são importados.
          </p>
        </div>
      </div>

      {/* Resultado do teste */}
      {testResult && (
        <div style={{ ...cardStyle, border:`1px solid ${testResult.ok ? 'rgba(74,222,128,.3)' : 'rgba(240,107,107,.3)'}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
            {testResult.ok ? <CheckCircle size={18} color="#4ade80" /> : <XCircle size={18} color="#f06b6b" />}
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
              {testResult.ok ? 'Conexão com Omiê OK' : 'Falha na conexão'}
            </span>
          </div>

          {testResult.error && (
            <div style={{ padding:'10px 14px', background:'rgba(240,107,107,.1)', borderRadius:8, fontSize:13, color:'#f06b6b' }}>
              {testResult.error}
            </div>
          )}

          {testResult.aviso_configuracao && (
            <div style={{ padding:'10px 14px', background:'rgba(251,146,60,.1)', border:'1px solid rgba(251,146,60,.3)', borderRadius:8, fontSize:12, color:'var(--warning)', marginBottom:12 }}>
              <strong>Atenção:</strong> {testResult.aviso_configuracao}
            </div>
          )}

          {testResult.ok && (
            <>
              <div style={{ display:'flex', gap:20, fontSize:13, color:'var(--text-secondary)', marginBottom:'1rem', flexWrap:'wrap' }}>
                <span>📦 <strong style={{ color:'var(--text-primary)' }}>{testResult.total_pedidos_todos}</strong> pedidos totais (últimos 30 dias)</span>
                {testResult.etapas_encontradas && (
                  <span>
                    📋 Etapas: {Object.entries(testResult.etapas_encontradas).map(([e, n]) => (
                      <span key={e} style={{ marginLeft:6, padding:'1px 8px', borderRadius:4,
                        background: testResult.etapas_configuradas?.includes(e) ? 'rgba(74,222,128,.15)' : 'var(--bg-card2)',
                        color: testResult.etapas_configuradas?.includes(e) ? '#4ade80' : 'var(--text-secondary)',
                        fontSize:11, fontWeight:600 }}>
                        {e} ({n})
                      </span>
                    ))}
                  </span>
                )}
              </div>

              {testResult.sample_converted && testResult.sample_converted.length > 0 && (
                <div style={{ marginBottom:'1rem' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>
                    AMOSTRA — PRIMEIRO PEDIDO CONVERTIDO
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                          {['data','cliente','vendedor','produto','marca','valor','qtd','bairro','omie_id'].map(k => (
                            <th key={k} style={{ padding:'6px 10px', textAlign:'left', color:'var(--text-secondary)', fontWeight:600, whiteSpace:'nowrap' }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResult.sample_converted.map((row, i) => (
                          <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                            {['data','cliente','vendedor','produto','marca','valor','quantidade','bairro','omie_id'].map(k => (
                              <td key={k} style={{ padding:'6px 10px', color:'var(--text-primary)', whiteSpace:'nowrap', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                                {k === 'valor' ? `R$ ${Number(row[k]).toLocaleString('pt-BR', { minimumFractionDigits:2 })}` : String(row[k] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {testResult.sample_fields && (
                <div>
                  <button onClick={() => setExpandRaw(v => !v)} style={{ ...btnSecondary, fontSize:12, padding:'6px 12px' }}>
                    <Info size={13} />
                    {expandRaw ? 'Ocultar campos' : 'Ver campos detectados (debug)'}
                    {expandRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {expandRaw && (
                    <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                      {Object.entries(testResult.sample_fields).map(([section, fields]) => (
                        <div key={section}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', marginBottom:4 }}>{section}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {(fields as string[]).map(f => (
                              <span key={f} style={{ padding:'2px 8px', borderRadius:6, background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', fontSize:11, fontFamily:"'IBM Plex Mono', monospace", color:'var(--accent)' }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Histórico */}
      <div style={cardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h3 style={{ fontSize:14, fontWeight:700, margin:0, color:'var(--text-primary)' }}>
            Histórico de Execuções
          </h3>
          <button onClick={fetchStatus} style={{ ...btnSecondary, padding:'5px 12px', fontSize:12 }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-tertiary)' }}>Carregando…</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-tertiary)', fontSize:13 }}>
            <AlertTriangle size={24} style={{ marginBottom:8 }} /><br />
            Nenhum sync executado ainda.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {logs.map(log => (
              <div key={log.id} style={{ background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', borderRadius:10, overflow:'hidden' }}>
                <div onClick={() => setExpandLog(expandLog === log.id ? null : log.id)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer' }}>
                  <StatusBadge status={log.status} />
                  <span style={{ fontSize:12, color:'var(--text-secondary)', flex:1 }}>{fmtDate(log.started_at)}</span>
                  {log.records_synced != null && (
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>
                      {log.records_synced.toLocaleString('pt-BR')} registros
                    </span>
                  )}
                  {expandLog === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {expandLog === log.id && (
                  <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border-subtle)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', fontSize:12 }}>
                    {[
                      ['Período', `${fmtDateOnly(log.date_from)} → ${fmtDateOnly(log.date_to)}`],
                      ['Início',  fmtDate(log.started_at)],
                      ['Fim',     fmtDate(log.finished_at)],
                      ['Registros', log.records_synced?.toLocaleString('pt-BR') ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span style={{ color:'var(--text-tertiary)' }}>{k}: </span>
                        <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{v}</span>
                      </div>
                    ))}
                    {log.error_msg && (
                      <div style={{ gridColumn:'1/-1', padding:'8px 12px', background:'rgba(240,107,107,.1)', borderRadius:6, color:'#f06b6b' }}>
                        ⚠ {friendlyError(log.error_msg)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
