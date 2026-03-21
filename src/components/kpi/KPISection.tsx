// ============================================================
// MÓDULO 4 — KPI Card + KPI Section
// ============================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useDashboardStore }  from '@/store/useDashboardStore'
import { buildKPIMetrics, formatCurrency, formatNumber, calcChange } from '@/services/analytics'
import type { KPIMetric } from '@/types'

const COLOR_MAP = {
  amber:  { stripe: '#f5a623', glow: 'rgba(245,166,35,.08)'  },
  green:  { stripe: '#22d3a0', glow: 'rgba(34,211,160,.08)'  },
  blue:   { stripe: '#5b8dee', glow: 'rgba(91,141,238,.08)'  },
  purple: { stripe: '#9b7bea', glow: 'rgba(155,123,234,.08)' },
}

function formatValue(value: number, format: KPIMetric['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value)
    case 'integer':  return formatNumber(Math.round(value))
    case 'decimal':  return formatNumber(value)
  }
}

interface KPICardProps {
  metric:  KPIMetric
  loading: boolean
  index:   number
}

function KPICard({ metric, loading, index }: KPICardProps) {
  const colors = COLOR_MAP[metric.color]
  const change = calcChange(metric.value, metric.previousValue)
  const hasPrev = metric.previousValue > 0

  return (
    <div
      className="card"
      style={{
        padding:    '1rem 1.1rem .9rem',
        position:   'relative',
        overflow:   'hidden',
        cursor:     'default',
        animation:  `fadeIn .3s ease ${index * 0.07}s both`,
        background: `linear-gradient(135deg, var(--bg-card) 0%, ${colors.glow} 100%)`,
      }}
    >
      <div style={{
        position:     'absolute',
        left:         0, top: 0, bottom: 0,
        width:        3,
        background:   colors.stripe,
        borderRadius: '12px 0 0 12px',
      }} />

      <div style={{ paddingLeft: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-secondary)', marginBottom: '.4rem' }}>
          {metric.label}
        </div>

        {loading ? (
          <div style={{ height: 28, background: 'var(--bg-card2)', borderRadius: 4, marginBottom: '.5rem' }} />
        ) : (
          <div
            className="mono"
            style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', marginBottom: '.45rem', color: 'var(--text-primary)', animation: 'countUp .4s cubic-bezier(.34,1.56,.64,1) both' }}
          >
            {formatValue(metric.value, metric.format)}
          </div>
        )}

        {hasPrev && !loading && (
          <div style={{ fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            {change > 0 ? (
              <>
                <TrendingUp size={11} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--success)' }}>+{change.toFixed(1)}%</span>
              </>
            ) : change < 0 ? (
              <>
                <TrendingDown size={11} style={{ color: 'var(--danger)' }} />
                <span style={{ color: 'var(--danger)' }}>{change.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <Minus size={11} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-tertiary)' }}>–</span>
              </>
            )}
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 2 }}>vs período anterior</span>
          </div>
        )}
      </div>
    </div>
  )
}

const PLACEHOLDERS: KPIMetric[] = [
  { id: 'revenue', label: 'Faturamento Total', value: 0, previousValue: 0, format: 'currency', icon: 'TrendingUp',   color: 'amber'  },
  { id: 'orders',  label: 'Pedidos',           value: 0, previousValue: 0, format: 'integer',  icon: 'ShoppingCart', color: 'blue'   },
  { id: 'ticket',  label: 'Ticket Médio',      value: 0, previousValue: 0, format: 'currency', icon: 'Receipt',      color: 'green'  },
  { id: 'qty',     label: 'Unidades Vendidas', value: 0, previousValue: 0, format: 'integer',  icon: 'Package',      color: 'purple' },
]

export function KPISection() {
  const { derived, isLoading } = useDashboardStore()
  const metrics = derived ? buildKPIMetrics(derived) : []
  const items   = metrics.length ? metrics : PLACEHOLDERS

  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap:                 '.75rem',
      marginBottom:        '.875rem',
    }}>
      {items.map((m, i) => (
        <KPICard key={m.id} metric={m} loading={isLoading || !derived} index={i} />
      ))}
    </div>
  )
}
