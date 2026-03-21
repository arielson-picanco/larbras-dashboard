// ============================================================
// MÓDULO 4 — Componentes de gráficos (Recharts)  v3
// ============================================================

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { useDashboardStore }          from '@/store/useDashboardStore'
import { formatCurrency, formatMonth } from '@/services/analytics'

// ── Shared tooltip ────────────────────────────────────────────────────────────
// Hardcoded colors because Recharts canvas can't read CSS vars at render time
const tooltipStyle = {
  background:   '#161929',
  border:       '1px solid rgba(91,141,238,.35)',
  borderRadius: 10,
  padding:      '10px 14px',
  fontSize:     12,
  color:        '#e2e8f0',
  boxShadow:    '0 16px 40px rgba(0,0,0,.65)',
  fontFamily:   "'DM Sans', system-ui, sans-serif",
  outline:      'none',
}
const tooltipLabelStyle = {
  color:        '#c4d1e0',
  fontSize:     11,
  fontWeight:   600,
  marginBottom: 5,
  letterSpacing: '.3px',
}
// itemStyle forces the value rows (name + value) to white — Recharts overrides otherwise
const tooltipItemStyle = {
  color:   '#e2e8f0',
  padding: '1px 0',
}

const CHART_COLORS = [
  '#f5a623','#5b8dee','#22d3a0','#9b7bea',
  '#fb923c','#f06b6b','#2dd4bf','#e879a8',
]

// ── Truncate long seller names for axis labels ────────────────────────────────
function truncName(name: string, max = 14): string {
  if (!name) return ''
  // Remove "(Inativo)" suffix to save space
  const clean = name.replace(/\s*\(Inativo\)/gi, '').trim()
  // Get first + last name only
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]
    const last  = parts[parts.length - 1]
    const short = `${first} ${last}`
    return short.length <= max ? short : first.slice(0, max)
  }
  return clean.slice(0, max)
}

// Custom XAxis tick for seller chart — abbreviated names + full name in tooltip
function SellerTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props
  const name = payload?.value ?? ''
  const short = truncName(name)
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={14}
        textAnchor="middle"
        fill="#94a8bf"
        fontSize={9.5}
        fontFamily="'DM Sans', system-ui, sans-serif"
        style={{ userSelect: 'none' }}
      >
        {short}
      </text>
    </g>
  )
}

// ── Revenue over time ─────────────────────────────────────────────────────────
export function RevenueChart() {
  const { derived } = useDashboardStore()
  const data = derived?.byDate ?? []
  if (!data.length) return <ChartEmpty label="Evolução de Receita" />

  return (
    <ChartCard title="Evolução de Receita" subtitle={`${data.length} pontos`}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f5a623" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonth}
            tick={{ fill: '#94a8bf', fontSize: 10, fontFamily: "'IBM Plex Mono'" }}
            axisLine={false} tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 6) - 1)}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0', 'R$')}
            tick={{ fill: '#94a8bf', fontSize: 10, fontFamily: "'IBM Plex Mono'" }}
            axisLine={false} tickLine={false} width={82}
          />
          <Tooltip
            formatter={(val: number) => [formatCurrency(val), 'Receita']}
            labelFormatter={(l) => `Data: ${l}`}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={{ stroke: '#f5a623', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone" dataKey="total"
            stroke="#f5a623" strokeWidth={2}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#f5a623', stroke: '#161929', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Revenue by product ────────────────────────────────────────────────────────
export function ProductChart() {
  const { derived } = useDashboardStore()
  const data = (derived?.byProduto ?? []).slice(0, 10).reverse()
  if (!data.length) return <ChartEmpty label="Receita por Produto" />

  return (
    <ChartCard title="Top 10 Produtos" subtitle="por receita">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0', 'R$')}
            tick={{ fill: '#94a8bf', fontSize: 9, fontFamily: "'IBM Plex Mono'" }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            type="category" dataKey="name"
            tick={{ fill: '#c4d1e0', fontSize: 10 }}
            axisLine={false} tickLine={false} width={120}
          />
          <Tooltip
            formatter={(val: number) => [formatCurrency(val), 'Receita']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={{ fill: 'rgba(255,255,255,.03)' }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.88} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Revenue by seller ─────────────────────────────────────────────────────────
export function SellerChart() {
  const { derived } = useDashboardStore()
  const data = (derived?.byVendedor ?? []).slice(0, 8)
  if (!data.length) return <ChartEmpty label="Receita por Vendedor" />

  // Dynamic height: enough room for bars + name labels
  const chartH = 240

  return (
    <ChartCard title="Desempenho de Vendedores" subtitle="receita total">
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 36, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            interval={0}
            // Use custom tick to render truncated names centered under bars
            tick={<SellerTick />}
            height={44}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0', 'R$')}
            tick={{ fill: '#94a8bf', fontSize: 9, fontFamily: "'IBM Plex Mono'" }}
            axisLine={false} tickLine={false} width={82}
          />
          <Tooltip
            formatter={(val: number) => [formatCurrency(val), 'Receita']}
            // Show full name in tooltip title (not truncated)
            labelFormatter={(label: string) => label}
            contentStyle={tooltipStyle}
            labelStyle={{ ...tooltipLabelStyle, fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}
            itemStyle={tooltipItemStyle}
            cursor={{ fill: 'rgba(255,255,255,.04)' }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.88} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Revenue by brand (donut) ──────────────────────────────────────────────────
export function BrandChart() {
  const { derived } = useDashboardStore()
  const data = (derived?.byMarca ?? []).slice(0, 8)
  if (!data.length) return <ChartEmpty label="Receita por Marca" />

  return (
    <ChartCard title="Participação por Marca" subtitle="% da receita">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data} dataKey="total" nameKey="name"
            cx="50%" cy="50%"
            innerRadius={56} outerRadius={88}
            strokeWidth={2} stroke="#161929"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(val: number) => [formatCurrency(val), 'Receita']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend
            iconType="square" iconSize={8}
            formatter={(v) => (
              <span style={{ fontSize: 10, color: '#94a8bf', fontFamily: "'DM Sans'" }}>{v}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Revenue by location ───────────────────────────────────────────────────────
export function LocationChart() {
  const { derived } = useDashboardStore()
  const data = (derived?.byBairro ?? []).slice(0, 10)
  const total = data.reduce((s, d) => s + d.total, 0)
  if (!data.length) return <ChartEmpty label="Receita por Localidade" />

  return (
    <ChartCard title="Receita por Localidade" subtitle="top 10">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
        {data.map((item, i) => {
          const pct = total ? (item.total / total) * 100 : 0
          return (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: '0 0 130px', fontSize: 11, color: '#c4d1e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
              <div style={{ flex: 1, height: 6, background: '#1a1e30', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width:        `${pct}%`,
                  height:       '100%',
                  background:   CHART_COLORS[i % CHART_COLORS.length],
                  borderRadius: 3,
                  transition:   'width .9s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
              <span style={{ flex: '0 0 96px', fontSize: 10, color: '#94a8bf', textAlign: 'right', fontFamily: "'IBM Plex Mono'" }}>
                {formatCurrency(item.total)}
              </span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

// ── Shared wrappers ───────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: '#94a8bf', marginBottom: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#c4d1e0' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 9, color: '#4e5f7a', fontWeight: 400 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: '#4e5f7a' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#4e5f7a' }}>Importe dados para visualizar</div>
    </div>
  )
}
