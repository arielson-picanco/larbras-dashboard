// ============================================================
// MÓDULO 9 — Comparação de Vendedores
// Seleção múltipla + radar de métricas + evolução temporal
// ============================================================

import { useState, useMemo }    from 'react'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts'
import { useDashboardStore }    from '@/store/useDashboardStore'
import { formatCurrency, formatMonth } from '@/services/analytics'
import { X, Plus, Users, TrendingUp, ShoppingCart, Receipt, Package }  from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const COMPARE_COLORS = [
  '#f5a623', '#5b8dee', '#22d3a0', '#9b7bea',
  '#fb923c', '#f06b6b', '#2dd4bf', '#e879a8',
]

const MAX_SELECT = 5

// ── Shared tooltip style ──────────────────────────────────────────────────────
const ttStyle = {
  background:   '#161929',
  border:       '1px solid rgba(91,141,238,.35)',
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     11,
  color:        '#e2e8f0',
  boxShadow:    '0 16px 40px rgba(0,0,0,.65)',
  fontFamily:   "'DM Sans', system-ui, sans-serif",
}
const ttLabel = { color: '#c4d1e0', fontSize: 11, fontWeight: 600, marginBottom: 4 }
const ttItem  = { color: '#e2e8f0', padding: '1px 0' }

// ── Truncate helper ───────────────────────────────────────────────────────────
function shortName(name: string): string {
  const clean  = name.replace(/\s*\(Inativo\)/gi, '').trim()
  const parts  = clean.split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`
  return clean.slice(0, 16)
}

// ── Vendor picker dropdown ────────────────────────────────────────────────────
function VendorPicker({
  allVendors, selected, onToggle, colors,
}: {
  allVendors: string[]
  selected:   string[]
  onToggle:   (v: string) => void
  colors:     string[]
}) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')

  const filtered = allVendors.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background:   'var(--accent)', border: 'none',
          color:        '#0b0d18', borderRadius: 8,
          padding:      '7px 14px', fontFamily: 'inherit',
          fontSize:     12, fontWeight: 700, cursor: 'pointer',
          display:      'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Plus size={13} />
        Adicionar vendedor
      </button>

      {open && (
        <div
          style={{
            position:   'absolute', top: '100%', left: 0, marginTop: 6,
            background: 'var(--bg-modal)', border: '1px solid var(--border-default)',
            borderRadius: 12, zIndex: 500, width: 300,
            boxShadow:  '0 16px 40px rgba(0,0,0,.5)',
            animation:  'fadeIn .15s ease', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              type="text" placeholder="Buscar vendedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map((v) => {
              const isSelected = selected.includes(v)
              const idx        = selected.indexOf(v)
              const atMax      = !isSelected && selected.length >= MAX_SELECT
              return (
                <button
                  key={v}
                  disabled={atMax}
                  onClick={() => { onToggle(v); if (!isSelected) setOpen(false) }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '9px 14px', display: 'flex', alignItems: 'center',
                    gap: 10, cursor: atMax ? 'not-allowed' : 'pointer',
                    textAlign: 'left', opacity: atMax ? 0.4 : 1,
                    transition: 'background .1s',
                  }}
                  onMouseOver={(e) => { if (!atMax) e.currentTarget.style.background = 'var(--bg-card2)' }}
                  onMouseOut={(e)  => { e.currentTarget.style.background = 'none' }}
                >
                  {isSelected ? (
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: colors[idx], flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={9} color="#fff" />
                    </span>
                  ) : (
                    <span style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--border-default)', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v}
                  </span>
                </button>
              )
            })}
          </div>
          {selected.length >= MAX_SELECT && (
            <div style={{ padding: '7px 14px', fontSize: 10, color: 'var(--warning)', borderTop: '1px solid var(--border-subtle)' }}>
              Máximo de {MAX_SELECT} vendedores para comparação
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, icon: Icon, values, format, colors }: {
  label: string
  icon: React.ElementType
  values: { name: string; value: number }[]
  format: 'currency' | 'integer'
  colors: string[]
}) {
  const fmt = (v: number) =>
    format === 'currency' ? formatCurrency(v) : v.toLocaleString('pt-BR')
  const max = Math.max(...values.map((v) => v.value), 1)

  return (
    <div className="card" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {values.map((v, i) => (
          <div key={v.name}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: colors[i], fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {shortName(v.name)}
              </span>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: 'var(--text-primary)', fontWeight: 700, flexShrink: 0 }}>
                {fmt(v.value)}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-card2)', borderRadius: 2 }}>
              <div style={{ width: `${(v.value / max) * 100}%`, height: '100%', background: colors[i], borderRadius: 2, transition: 'width .8s cubic-bezier(.4,0,.2,1)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main comparison component ─────────────────────────────────────────────────
export function VendorComparison() {
  const { filteredRows, derived, allRows } = useDashboardStore()

  // Get full list from allRows (not filtered) for vendor selection
  const allVendors = useMemo(() => {
    const set = new Set<string>()
    allRows.forEach((r) => { if (r._vendedor && r._vendedor !== 'N/A') set.add(r._vendedor) })
    return [...set].sort()
  }, [allRows])

  const [selected, setSelected] = useState<string[]>([])

  const toggle = (v: string) => {
    setSelected((prev) =>
      prev.includes(v)
        ? prev.filter((x) => x !== v)
        : prev.length < MAX_SELECT ? [...prev, v] : prev
    )
  }

  // ── Per-vendor aggregation ────────────────────────────────────────────────
  const vendorData = useMemo(() => {
    if (!selected.length) return []
    return selected.map((name, idx) => {
      const rows    = filteredRows.filter((r) => r._vendedor === name)
      const total   = rows.reduce((s, r) => s + r._val, 0)
      const orders  = rows.length
      const qty     = rows.reduce((s, r) => s + r._qtd, 0)
      const ticket  = orders ? total / orders : 0
      const color   = COMPARE_COLORS[idx]

      // Products breakdown
      const prodMap = new Map<string, number>()
      rows.forEach((r) => prodMap.set(r._produto, (prodMap.get(r._produto) ?? 0) + r._val))
      const topProducts = [...prodMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n, v]) => ({ name: n, value: v }))

      // Daily revenue
      const dateMap = new Map<string, number>()
      rows.forEach((r) => {
        if (!r._date) return
        const key = r._date.toISOString().slice(0, 10)
        dateMap.set(key, (dateMap.get(key) ?? 0) + r._val)
      })
      const byDate = [...dateMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }))

      return { name, color, total, orders, qty, ticket, topProducts, byDate }
    })
  }, [selected, filteredRows])

  // ── Normalized radar data ──────────────────────────────────────────────────
  const radarData = useMemo(() => {
    if (!vendorData.length) return []
    const maxTotal  = Math.max(...vendorData.map((v) => v.total),  1)
    const maxOrders = Math.max(...vendorData.map((v) => v.orders), 1)
    const maxTicket = Math.max(...vendorData.map((v) => v.ticket), 1)
    const maxQty    = Math.max(...vendorData.map((v) => v.qty),    1)

    return [
      { metric: 'Faturamento',   ...Object.fromEntries(vendorData.map((v) => [shortName(v.name), Math.round((v.total   / maxTotal)  * 100)])) },
      { metric: 'Pedidos',       ...Object.fromEntries(vendorData.map((v) => [shortName(v.name), Math.round((v.orders  / maxOrders) * 100)])) },
      { metric: 'Ticket Médio',  ...Object.fromEntries(vendorData.map((v) => [shortName(v.name), Math.round((v.ticket  / maxTicket) * 100)])) },
      { metric: 'Unidades',      ...Object.fromEntries(vendorData.map((v) => [shortName(v.name), Math.round((v.qty     / maxQty)    * 100)])) },
    ]
  }, [vendorData])

  // ── Unified timeline ──────────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    if (!vendorData.length) return []
    const allDates = new Set<string>()
    vendorData.forEach((v) => v.byDate.forEach((d) => allDates.add(d.date)))
    return [...allDates].sort().map((date) => ({
      date,
      ...Object.fromEntries(vendorData.map((v) => {
        const found = v.byDate.find((d) => d.date === date)
        return [shortName(v.name), found?.value ?? 0]
      })),
    }))
  }, [vendorData])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!allRows.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', gap: 16 }}>
        <Users size={32} style={{ color: 'var(--text-tertiary)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Importe dados para comparar vendedores</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Comparação de Vendedores
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            — selecione até {MAX_SELECT}
          </span>
        </div>

        {/* Selected chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {selected.map((v, i) => (
            <div
              key={v}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: `${COMPARE_COLORS[i]}18`,
                border:     `1px solid ${COMPARE_COLORS[i]}40`,
                borderRadius: 20, padding: '4px 10px',
                fontSize: 11, color: COMPARE_COLORS[i], fontWeight: 600,
                animation: 'fadeIn .2s ease',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COMPARE_COLORS[i], flexShrink: 0 }} />
              {shortName(v)}
              <button
                onClick={() => toggle(v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: COMPARE_COLORS[i], display: 'flex', padding: 0, marginLeft: 2 }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>

        <VendorPicker
          allVendors={allVendors}
          selected={selected}
          onToggle={toggle}
          colors={COMPARE_COLORS}
        />
      </div>

      {/* ── Empty selection ── */}
      {!selected.length && (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <Users size={32} style={{ color: 'var(--text-tertiary)', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Clique em <strong style={{ color: 'var(--accent)' }}>Adicionar vendedor</strong> para iniciar a comparação
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Você pode selecionar até {MAX_SELECT} vendedores · {allVendors.length} disponíveis
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {selected.length > 0 && (
        <div>

          {/* ── KPI cards row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '.75rem', marginBottom: '.75rem' }}>
            <MetricCard
              label="Faturamento Total"
              icon={TrendingUp}
              values={vendorData.map((v) => ({ name: v.name, value: v.total }))}
              format="currency"
              colors={vendorData.map((v) => v.color)}
            />
            <MetricCard
              label="Ticket Médio por Pedido"
              icon={Receipt}
              values={vendorData.map((v) => ({ name: v.name, value: v.ticket }))}
              format="currency"
              colors={vendorData.map((v) => v.color)}
            />
            <MetricCard
              label="Número de Pedidos"
              icon={ShoppingCart}
              values={vendorData.map((v) => ({ name: v.name, value: v.orders }))}
              format="integer"
              colors={vendorData.map((v) => v.color)}
            />
            <MetricCard
              label="Unidades Vendidas"
              icon={Package}
              values={vendorData.map((v) => ({ name: v.name, value: v.qty }))}
              format="integer"
              colors={vendorData.map((v) => v.color)}
            />
          </div>

          {/* ── Radar + Timeline ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '.75rem', marginBottom: '.75rem' }}>

            {/* Radar chart */}
            <div className="card" style={{ padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)', marginBottom: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Perfil Comparativo</span>
                <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)' }}>escala normalizada 0–100</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                  <PolarGrid stroke="rgba(45,52,84,.8)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: '#94a8bf', fontSize: 10, fontFamily: "'DM Sans'" }}
                  />
                  {vendorData.map((v) => (
                    <Radar
                      key={v.name}
                      name={shortName(v.name)}
                      dataKey={shortName(v.name)}
                      stroke={v.color}
                      fill={v.color}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    iconType="circle" iconSize={7}
                    formatter={(val) => <span style={{ fontSize: 10, color: '#94a8bf' }}>{val}</span>}
                  />
                  <Tooltip contentStyle={ttStyle} labelStyle={ttLabel} itemStyle={ttItem} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Timeline */}
            {timelineData.length > 1 ? (
              <div className="card" style={{ padding: '1rem 1.1rem' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)', marginBottom: '.875rem' }}>
                  Evolução de Receita no Período
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      {vendorData.map((v) => (
                        <linearGradient key={v.name} id={`grad_${v.name.slice(0,6)}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={v.color} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={v.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" />
                    <XAxis
                      dataKey="date" tickFormatter={formatMonth}
                      tick={{ fill: '#94a8bf', fontSize: 9, fontFamily: "'IBM Plex Mono'" }}
                      axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(timelineData.length / 5) - 1)}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0','R$')}
                      tick={{ fill: '#94a8bf', fontSize: 9, fontFamily: "'IBM Plex Mono'" }}
                      axisLine={false} tickLine={false} width={82}
                    />
                    <Tooltip
                      formatter={(val: number, name: string) => [formatCurrency(val), name]}
                      labelFormatter={(l) => `Data: ${l}`}
                      contentStyle={ttStyle} labelStyle={ttLabel} itemStyle={ttItem}
                    />
                    {vendorData.map((v) => (
                      <Area
                        key={v.name}
                        type="monotone"
                        dataKey={shortName(v.name)}
                        stroke={v.color} strokeWidth={2}
                        fill={`url(#grad_${v.name.slice(0,6)})`}
                        dot={false}
                        activeDot={{ r: 4, fill: v.color, stroke: '#161929', strokeWidth: 2 }}
                      />
                    ))}
                    <Legend
                      iconType="circle" iconSize={7}
                      formatter={(val) => <span style={{ fontSize: 10, color: '#94a8bf' }}>{val}</span>}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card" style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sem dados temporais suficientes</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Aplique um filtro de período com mais datas</div>
              </div>
            )}
          </div>

          {/* ── Top products per vendor ── */}
          <div className="card" style={{ padding: '1rem 1.1rem', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)', marginBottom: '.875rem' }}>
              Top 5 Produtos por Vendedor
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selected.length, 3)}, minmax(0,1fr))`, gap: 12 }}>
              {vendorData.map((v) => {
                const maxProd = v.topProducts[0]?.value ?? 1
                return (
                  <div key={v.name}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: v.color, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortName(v.name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {v.topProducts.map((p, pi) => (
                        <div key={p.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                              {p.name}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'IBM Plex Mono'", flexShrink: 0 }}>
                              {formatCurrency(p.value)}
                            </span>
                          </div>
                          <div style={{ height: 3, background: 'var(--bg-card2)', borderRadius: 2 }}>
                            <div style={{ width: `${(p.value / maxProd) * 100}%`, height: '100%', background: v.color, borderRadius: 2, opacity: 0.7 + pi * -0.1 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Summary table ── */}
          <div className="card" style={{ overflow: 'hidden', marginTop: '.75rem' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
              Resumo Comparativo
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Vendedor', 'Faturamento', 'Pedidos', 'Ticket Médio', 'Unidades', '% do Total Filtrado'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i > 0 ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorData
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((v, i) => {
                    const pct = derived?.totalRevenue
                      ? ((v.total / derived.totalRevenue) * 100).toFixed(1)
                      : '0.0'
                    return (
                      <tr key={v.name}
                        style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                        onMouseOver={(e) => (e.currentTarget.style.background = `${v.color}08`)}
                        onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                              {v.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: v.color, fontFamily: "'IBM Plex Mono'", fontWeight: 700, fontSize: 11 }}>
                          {formatCurrency(v.total)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'" }}>{v.orders}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono'", fontSize: 11 }}>
                          {formatCurrency(v.ticket)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'" }}>{v.qty}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <div style={{ width: 50, height: 4, background: 'var(--bg-card2)', borderRadius: 2 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: v.color, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", minWidth: 36 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
