// ============================================================
// MÓDULO 6 — Botão de exportação PDF / Excel
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { useDashboardStore }   from '@/store/useDashboardStore'
import { exportToExcel, exportToPDF } from '@/services/export'

export function ExportButton() {
  const { filteredRows, derived } = useDashboardStore()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState<'excel' | 'pdf' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const disabled = !filteredRows.length || !derived

  const handleExcel = async () => {
    if (!derived) return
    setLoading('excel'); setOpen(false)
    try { exportToExcel(filteredRows, derived) }
    finally { setLoading(null) }
  }

  const handlePDF = async () => {
    if (!derived) return
    setLoading('pdf'); setOpen(false)
    try { exportToPDF(filteredRows, derived) }
    finally { setLoading(null) }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          background:   'var(--bg-card2)',
          border:       '1px solid var(--border-default)',
          color:        disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
          borderRadius: 8,
          padding:      '6px 12px',
          fontFamily:   'inherit',
          fontSize:     11,
          fontWeight:   600,
          cursor:       disabled ? 'not-allowed' : 'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          opacity:      disabled ? 0.5 : 1,
          transition:   'all .15s',
        }}
      >
        {loading ? (
          <div style={{ width: 12, height: 12, border: '2px solid var(--text-tertiary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        ) : (
          <Download size={13} />
        )}
        Exportar
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          style={{
            position:   'absolute',
            top:        '100%',
            right:      0,
            marginTop:  6,
            background: 'var(--bg-modal)',
            border:     '1px solid var(--border-default)',
            borderRadius: 10,
            overflow:   'hidden',
            zIndex:     400,
            minWidth:   180,
            boxShadow:  'var(--shadow-modal)',
            animation:  'fadeIn .15s ease',
          }}
        >
          {[
            { id: 'excel', label: 'Exportar Excel (.xlsx)', Icon: FileSpreadsheet, onClick: handleExcel, color: '#22d3a0' },
            { id: 'pdf',   label: 'Exportar PDF',           Icon: FileText,        onClick: handlePDF,   color: '#f06b6b' },
          ].map(({ id, label, Icon, onClick, color }) => (
            <button
              key={id}
              onClick={onClick}
              style={{
                width:       '100%',
                background:  'none',
                border:      'none',
                padding:     '10px 14px',
                display:     'flex',
                alignItems:  'center',
                gap:         10,
                cursor:      'pointer',
                fontSize:    12,
                color:       'var(--text-primary)',
                fontFamily:  'inherit',
                transition:  'background .1s',
                textAlign:   'left',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-card2)')}
              onMouseOut={(e)  => (e.currentTarget.style.background = 'none')}
            >
              <Icon size={14} style={{ color, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>{label}</div>
                {id === 'pdf' && filteredRows.length > 500 && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    Limitado a 500 linhas
                  </div>
                )}
              </div>
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              {filteredRows.length.toLocaleString('pt-BR')} registros com filtros atuais
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
