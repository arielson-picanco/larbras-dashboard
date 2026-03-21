// ============================================================
// MÓDULO 8 — Mapa de Calor por Bairros  (v3 — light mode fix)
// ============================================================

import { useMemo } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { formatCurrency }    from '@/services/analytics'

// ── Color interpolation: blue → green → amber → red ──────────────────────────
function heatColor(ratio: number): string {
  const stops = [
    { r: 91,  g: 141, b: 238 },  // blue
    { r: 34,  g: 211, b: 160 },  // teal
    { r: 245, g: 166, b: 35  },  // amber
    { r: 240, g: 107, b: 107 },  // red
  ]
  const t    = Math.max(0, Math.min(1, ratio)) * (stops.length - 1)
  const lo   = Math.floor(t)
  const hi   = Math.min(stops.length - 1, lo + 1)
  const frac = t - lo
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * frac)
  const c    = {
    r: lerp(stops[lo].r, stops[hi].r),
    g: lerp(stops[lo].g, stops[hi].g),
    b: lerp(stops[lo].b, stops[hi].b),
  }
  return `rgb(${c.r},${c.g},${c.b})`
}

// ── Luminance check: should text be dark or light on this bg? ─────────────────
// Returns true if the background is light (text should be dark)
function isLightBg(rgbStr: string, alpha: number, isDarkTheme: boolean): boolean {
  if (isDarkTheme) return false   // dark theme: always white text
  // Light theme: card bg is white + colored overlay at low alpha
  // Low alpha = mostly white = need dark text
  // High alpha = saturated color = check luminance of the color
  if (alpha < 0.5) return true    // very light tint → dark text
  const m = rgbStr.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (!m) return true
  const [r, g, b] = [+m[1], +m[2], +m[3]]
  // Perceived luminance (0–255): >128 = light bg
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 160
}

function gridCols(n: number): number {
  if (n <= 2)  return 2
  if (n <= 6)  return 3
  if (n <= 12) return 4
  if (n <= 20) return 5
  return 6
}

export function BairroHeatmap() {
  const { derived, theme } = useDashboardStore()
  const isDark = theme === 'dark'
  const items  = derived?.byBairro ?? []

  const data = useMemo(() => {
    if (!items.length) return []
    const max   = items[0]?.total ?? 1
    const total = items.reduce((s, b) => s + b.total, 0)
    return items.map((b) => ({
      ...b,
      ratio: b.total / max,
      pct:   ((b.total / total) * 100).toFixed(1),
    }))
  }, [items])

  if (!data.length) {
    return (
      <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Importe dados para visualizar o mapa de calor</div>
      </div>
    )
  }

  const cols = gridCols(data.length)

  return (
    <div>
      {/* Heat grid */}
      <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: '.75rem' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)', marginBottom: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Mapa de Calor — Receita por Bairro</span>
          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-tertiary)' }}>{data.length} localidades</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6 }}>
          {data.map((b, i) => {
            const bg    = heatColor(b.ratio)
            // Dark mode: stronger alpha (more vivid), Light mode: softer alpha (pastel)
            const alpha = isDark
              ? 0.18 + b.ratio * 0.65
              : 0.20 + b.ratio * 0.55

            const cardBg = bg.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
            const border  = bg.replace('rgb', 'rgba').replace(')', isDark ? ', 0.4)' : ', 0.5)')

            // Text color: dark theme = always white; light theme = dark text for readability
            const textColor   = isDark ? '#ffffff'        : '#111827'
            const subColor    = isDark ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.65)'
            const barTrackBg  = isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'
            const rankColor   = isDark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)'

            return (
              <div
                key={b.name}
                title={`${b.name}\n${formatCurrency(b.total)}\n${b.orders} pedidos`}
                style={{
                  position:       'relative',
                  borderRadius:   8,
                  padding:        '10px 8px 8px',
                  background:     cardBg,
                  border:         `1px solid ${border}`,
                  cursor:         'default',
                  transition:     'transform .15s, box-shadow .15s',
                  animation:      `fadeIn .25s ease ${i * 0.025}s both`,
                  minHeight:      72,
                  display:        'flex',
                  flexDirection:  'column',
                  justifyContent: 'space-between',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)'
                  e.currentTarget.style.boxShadow = `0 4px 16px ${bg.replace('rgb','rgba').replace(')',', .3)')}`
                  e.currentTarget.style.zIndex = '2'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.zIndex = '1'
                }}
              >
                {/* Rank badge */}
                <div style={{ position: 'absolute', top: 5, right: 6, fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono'", color: rankColor }}>
                  #{i + 1}
                </div>

                {/* Name */}
                <div style={{ fontSize: 10, fontWeight: 700, color: textColor, lineHeight: 1.2, paddingRight: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>

                {/* Value + progress */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono'", color: textColor, marginTop: 6 }}>
                    {formatCurrency(b.total)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, background: barTrackBg, borderRadius: 2 }}>
                      <div style={{ width: `${b.ratio * 100}%`, height: '100%', background: isDark ? bg : bg.replace('rgb', 'rgba').replace(')', ', 0.7)'), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, color: subColor, fontFamily: "'IBM Plex Mono'", minWidth: 32, fontWeight: 600, textAlign: 'right' }}>
                      {b.pct}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scale legend */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>Baixo</span>
          <div style={{
            flex: 1, height: 6, borderRadius: 3,
            background: 'linear-gradient(to right, rgba(91,141,238,.6), rgba(34,211,160,.6), rgba(245,166,35,.6), rgba(240,107,107,.6))',
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>Alto</span>
        </div>
      </div>

      {/* Ranking table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          Ranking Detalhado por Localidade
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['#', 'Bairro/Localidade', 'Receita', 'Pedidos', 'Ticket Médio', '% do Total', 'Intensidade'].map((h, i) => (
                <th key={h} style={{ padding: '7px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <tr
                key={b.name}
                style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.06)')}
                onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, width: 36 }}>{i + 1}</td>
                <td style={{ padding: '7px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: heatColor(b.ratio), flexShrink: 0 }} />
                    {b.name}
                  </div>
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--accent)', fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
                  {formatCurrency(b.total)}
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>{b.orders}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, textAlign: 'right' }}>
                  {formatCurrency(b.total / b.orders)}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'var(--text-secondary)' }}>
                  {b.pct}%
                </td>
                <td style={{ padding: '7px 20px 7px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 80, height: 5, background: 'var(--bg-card2)', borderRadius: 3 }}>
                      <div style={{ width: `${b.ratio * 100}%`, height: '100%', background: heatColor(b.ratio), borderRadius: 3, transition: 'width .9s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
