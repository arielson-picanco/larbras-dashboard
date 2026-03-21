// ============================================================
// MÓDULO 5 — Tabela de dados detalhada
// Paginação, ordenação por coluna, busca inline.
// ============================================================

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useDashboardStore }            from '@/store/useDashboardStore'
import { querySales, DEFAULT_TABLE_COLUMNS } from '@/services/api'
import { formatCurrency, formatDate }  from '@/services/analytics'
import type { SaleRow, Paginated, SortState } from '@/types'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

function formatCell(row: SaleRow, col: (typeof DEFAULT_TABLE_COLUMNS)[0]): string {
  const raw = row[col.key as keyof SaleRow]
  if (raw === null || raw === undefined) return '—'

  switch (col.format) {
    case 'currency': return formatCurrency(Number(raw))
    case 'date':     return raw instanceof Date ? formatDate(raw) : '—'
    case 'integer':  return Number(raw).toLocaleString('pt-BR')
    default:         return String(raw)
  }
}

function SortIcon({ column, sort }: { column: string; sort: SortState | null }) {
  if (!sort || sort.column !== column) return <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
  return sort.dir === 'asc'
    ? <ChevronUp size={11} style={{ color: 'var(--accent)' }} />
    : <ChevronDown size={11} style={{ color: 'var(--accent)' }} />
}

export function DataTable() {
  const { filters, filteredRows } = useDashboardStore()

  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sort,     setSort]     = useState<SortState | null>(null)
  const [result,   setResult]   = useState<Paginated<SaleRow> | null>(null)
  const [loading,  setLoading]  = useState(false)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filters])

  // Fetch page
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    querySales({
      filters,
      page,
      pageSize,
      sortBy:  sort?.column,
      sortDir: sort?.dir,
    }).then((res) => {
      if (!cancelled) { setResult(res); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [filters, page, pageSize, sort])

  const handleSort = (col: string) => {
    setSort((prev) =>
      prev?.column === col
        ? prev.dir === 'asc' ? { column: col, dir: 'desc' } : null
        : { column: col, dir: 'asc' }
    )
    setPage(1)
  }

  const totalPages = result?.totalPages ?? 1
  const total      = result?.total ?? 0
  const items      = result?.items ?? []

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* ── Table header controls ── */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          Dados Detalhados
          <span style={{ marginLeft: 8, fontFamily: "'IBM Plex Mono'", color: 'var(--text-tertiary)', fontSize: 9, fontWeight: 400 }}>
            {total.toLocaleString('pt-BR')} registros
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Linhas:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="select-field"
            style={{ minWidth: 'unset', padding: '3px 24px 3px 8px', appearance: 'none' }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Scrollable table ── */}
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,13,24,.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Carregando…</div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {DEFAULT_TABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding:       '8px 12px',
                    textAlign:     col.align ?? 'left',
                    fontSize:      9,
                    fontWeight:    700,
                    textTransform: 'uppercase',
                    letterSpacing: '.6px',
                    color:         sort?.column === col.key ? 'var(--accent)' : 'var(--text-tertiary)',
                    cursor:        col.sortable ? 'pointer' : 'default',
                    whiteSpace:    'nowrap',
                    width:         col.width,
                    userSelect:    'none',
                    background:    'var(--bg-card)',
                    position:      'sticky',
                    top:           0,
                    zIndex:        2,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    {col.sortable && <SortIcon column={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={DEFAULT_TABLE_COLUMNS.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {filteredRows.length === 0 ? 'Nenhum dado importado' : 'Nenhum registro corresponde aos filtros'}
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background:   i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)',
                    transition:   'background .1s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.04)')}
                  onMouseOut={(e)  => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)')}
                >
                  {DEFAULT_TABLE_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding:    '7px 12px',
                        textAlign:  col.align ?? 'left',
                        color:      col.format === 'currency' ? 'var(--accent)' : 'var(--text-primary)',
                        fontFamily: col.format === 'currency' || col.format === 'integer' ? "'IBM Plex Mono'" : 'inherit',
                        fontSize:   col.format === 'currency' ? 11 : 12,
                        fontWeight: col.format === 'currency' ? 600 : 400,
                        whiteSpace: 'nowrap',
                        maxWidth:   col.width ?? 200,
                        overflow:   'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {formatCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'IBM Plex Mono'" }}>
            {((page - 1) * pageSize + 1).toLocaleString('pt-BR')}–{Math.min(page * pageSize, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PageBtn onClick={() => setPage(1)}        disabled={page === 1}>«</PageBtn>
            <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</PageBtn>

            {/* Page window */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const n = start + i
              if (n > totalPages) return null
              return (
                <PageBtn key={n} onClick={() => setPage(n)} active={n === page}>{n}</PageBtn>
              )
            })}

            <PageBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</PageBtn>
            <PageBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</PageBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PageBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:        28,
        height:       28,
        borderRadius: 6,
        border:       `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        background:   active ? 'var(--accent-muted)' : 'transparent',
        color:        active ? 'var(--accent)' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        fontSize:     12,
        fontFamily:   'inherit',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        transition:   'all .12s',
      }}
    >
      {children}
    </button>
  )
}
