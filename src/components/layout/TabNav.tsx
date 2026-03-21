// ============================================================
// MÓDULO 3 — Navegação por abas
// ============================================================

import { Sparkles, Users, Package, Tag } from 'lucide-react'
import { useDashboardStore } from '@/store/useDashboardStore'

const TABS = [
  { id: 'overview',         label: 'Visão Geral' },
  { id: 'products',         label: 'Produtos' },
  { id: 'sellers',          label: 'Vendedores' },
  { id: 'comparison',       label: 'Comparar Vendedores', accent: true },
  { id: 'productComparison',label: 'Comparar Produtos',   accent: true },
  { id: 'markup',           label: 'Markup / Preços' },
  { id: 'feirao',           label: 'Feirão', accent: true },
  { id: 'clients',          label: 'Clientes' },
  { id: 'heatmap',          label: 'Mapa de Calor' },
  { id: 'insights',         label: 'Insights IA', accent: true },
  { id: 'table',            label: 'Dados Detalhados' },
]

export function TabNav() {
  const { activeTab, setActiveTab } = useDashboardStore()

  return (
    <nav
      style={{
        background:     'var(--bg-secondary)',
        borderBottom:   '1px solid var(--border-subtle)',
        padding:        '0 1.5rem',
        display:        'flex',
        alignItems:     'flex-end',
        overflowX:      'auto',
        transition:     'background .2s',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id
        const color  = active
          ? (tab.accent ? 'var(--accent)' : 'var(--accent)')
          : 'var(--text-secondary)'

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background:   'none',
              border:       'none',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              color,
              fontFamily:   'inherit',
              fontSize:     12,
              fontWeight:   active ? 600 : 400,
              padding:      '10px 16px 9px',
              cursor:       'pointer',
              transition:   'all .15s',
              whiteSpace:   'nowrap',
              flexShrink:   0,
              display:      'flex',
              alignItems:   'center',
              gap:          5,
            }}
            onMouseOver={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseOut={(e)  => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {tab.accent && tab.id === 'comparison'        && <Users    size={11} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
            {tab.accent && tab.id === 'feirao'            && <Tag      size={11} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
            {tab.accent && tab.id === 'productComparison' && <Package  size={11} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
            {tab.accent && tab.id === 'insights'          && <Sparkles size={11} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
