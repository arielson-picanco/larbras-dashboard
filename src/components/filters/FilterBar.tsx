// ============================================================
// MÓDULO 3 — Barra de filtros com date range picker
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { Calendar, X, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { countActiveFilters } from '@/services/filters'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PERIODS = [
  { label: 'Todos',  value: 0 },
  { label: '7d',     value: 7 },
  { label: '30d',    value: 30 },
  { label: '90d',    value: 90 },
  { label: '180d',   value: 180 },
]

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="select-field"
          style={{ minWidth: 90, maxWidth: 160, paddingRight: 26, appearance: 'none' }}
        >
          <option value="">Todos</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
      </div>
    </div>
  )
}

function DateRangePicker() {
  const { filters, setFilters } = useDashboardStore()
  const [open, setOpen] = useState(false)
  const [pickFrom, setPickFrom] = useState(false)
  const [pickTo,   setPickTo]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const from = filters.dateRange.from
  const to   = filters.dateRange.to

  const label = from || to
    ? [from && format(from, 'dd/MM/yy'), to && format(to, 'dd/MM/yy')].filter(Boolean).join(' → ')
    : 'Período'

  const hasRange = from || to

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background:   hasRange ? 'var(--accent-muted)' : 'var(--bg-card2)',
          border:       `1px solid ${hasRange ? 'rgba(245,166,35,.3)' : 'var(--border-default)'}`,
          color:        hasRange ? 'var(--accent)' : 'var(--text-secondary)',
          borderRadius: 8,
          padding:      '5px 10px',
          fontFamily:   'inherit',
          fontSize:     11,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          transition:   'all .15s',
          whiteSpace:   'nowrap',
        }}
      >
        <Calendar size={12} />
        {label}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          style={{
            position:   'absolute',
            top:        '100%',
            left:       0,
            marginTop:  6,
            background: 'var(--bg-modal)',
            border:     '1px solid var(--border-default)',
            borderRadius: 10,
            padding:    '1rem',
            zIndex:     400,
            minWidth:   260,
            boxShadow:  'var(--shadow-modal)',
            animation:  'fadeIn .15s ease',
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
            Intervalo personalizado
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>De</span>
              <input
                type="date"
                className="input"
                value={from ? format(from, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const d = e.target.value ? new Date(e.target.value + 'T00:00:00') : null
                  setFilters({ dateRange: { from: d, to }, period: 0 })
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Até</span>
              <input
                type="date"
                className="input"
                value={to ? format(to, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const d = e.target.value ? new Date(e.target.value + 'T23:59:59') : null
                  setFilters({ dateRange: { from, to: d }, period: 0 })
                }}
              />
            </label>
          </div>

          {hasRange && (
            <button
              onClick={() => { setFilters({ dateRange: { from: null, to: null }, period: 0 }); setOpen(false) }}
              style={{
                marginTop:    10,
                width:        '100%',
                background:   'transparent',
                border:       '1px solid var(--border-default)',
                color:        'var(--text-secondary)',
                borderRadius: 6,
                padding:      '5px 0',
                fontSize:     11,
                cursor:       'pointer',
                fontFamily:   'inherit',
              }}
            >
              Limpar datas
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function FilterBar() {
  const { filters, setFilters, resetFilters, filteredRows, allRows, getUniqueValues } = useDashboardStore()
  const activeCount = countActiveFilters(filters)

  const vendedores = getUniqueValues('_vendedor')
  const produtos   = getUniqueValues('_produto')
  const marcas     = getUniqueValues('_marca')
  const bairros    = getUniqueValues('_bairro')

  return (
    <div
      style={{
        background:   'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding:      '.6rem 1.5rem .55rem',
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        flexWrap:     'wrap',
        transition:   'background .2s',
      }}
    >
      {/* Filter icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', flexShrink: 0 }}>
        <SlidersHorizontal size={13} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px' }}>
          Filtros
        </span>
        {activeCount > 0 && (
          <span style={{
            background:   'var(--accent)',
            color:        '#0b0d18',
            borderRadius: '50%',
            width:        16,
            height:       16,
            fontSize:     9,
            fontWeight:   700,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
          }}>{activeCount}</span>
        )}
      </div>

      {/* Period pills */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilters({ period: p.value, dateRange: { from: null, to: null } })}
            style={{
              background:   filters.period === p.value && !filters.dateRange.from && !filters.dateRange.to
                ? 'var(--accent-muted)' : 'transparent',
              border:       `1px solid ${filters.period === p.value && !filters.dateRange.from && !filters.dateRange.to
                ? 'rgba(245,166,35,.3)' : 'var(--border-subtle)'}`,
              color:        filters.period === p.value && !filters.dateRange.from && !filters.dateRange.to
                ? 'var(--accent)' : 'var(--text-secondary)',
              borderRadius: 6,
              padding:      '4px 10px',
              fontSize:     11,
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'inherit',
              transition:   'all .15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <DateRangePicker />

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Dynamic selects */}
      {vendedores.length > 0 && (
        <Select label="Vendedor" value={filters.vendedor} onChange={(v) => setFilters({ vendedor: v })} options={vendedores} />
      )}
      {produtos.length > 0 && (
        <Select label="Produto" value={filters.produto} onChange={(v) => setFilters({ produto: v })} options={produtos} />
      )}
      {marcas.length > 0 && (
        <Select label="Marca" value={filters.marca} onChange={(v) => setFilters({ marca: v })} options={marcas} />
      )}
      {bairros.length > 0 && (
        <Select label="Local" value={filters.bairro} onChange={(v) => setFilters({ bairro: v })} options={bairros} />
      )}

      {/* Search */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          placeholder="Buscar…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="input"
          style={{ paddingLeft: 26, width: 160 }}
        />
      </div>

      {/* Clear + count */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize:   10,
          color:      'var(--text-tertiary)',
          background: 'var(--bg-card2)',
          border:     '1px solid var(--border-subtle)',
          borderRadius: 5,
          padding:    '3px 8px',
          fontFamily: "'IBM Plex Mono', monospace",
          whiteSpace: 'nowrap',
        }}>
          {filteredRows.length.toLocaleString('pt-BR')} / {allRows.length.toLocaleString('pt-BR')}
        </span>

        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            style={{
              background:   'transparent',
              border:       '1px solid var(--border-default)',
              color:        'var(--text-secondary)',
              borderRadius: 6,
              padding:      '4px 10px',
              fontSize:     11,
              cursor:       'pointer',
              fontFamily:   'inherit',
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              transition:   'all .15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--danger)'
              e.currentTarget.style.color = 'var(--danger)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <X size={11} /> Limpar
          </button>
        )}
      </div>
    </div>
  )
}
