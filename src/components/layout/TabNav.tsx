// ============================================================
// MÓDULO 3 — Navegação por abas (com controle de acesso por role)
// ============================================================

import { Sparkles, Users, Package, Tag, Wifi } from 'lucide-react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { useAuth }           from '@/contexts/AuthContext'

// Abas com roles permitidos ('*' = qualquer autenticado)
const ALL_TABS = [
  { id: 'overview',          label: 'Visão Geral',           roles: ['admin'] },
  { id: 'products',          label: 'Produtos',              roles: ['admin', 'gerente', 'marketing'] },
  { id: 'sellers',           label: 'Vendedores',            roles: ['admin', 'gerente', 'marketing'] },
  { id: 'comparison',        label: 'Comparar Vendedores',   roles: ['admin', 'gerente', 'marketing'], accent: true },
  { id: 'productComparison', label: 'Comparar Produtos',     roles: ['admin', 'gerente', 'marketing'], accent: true },
  { id: 'markup',            label: 'Markup / Preços',       roles: ['admin'] },
  { id: 'feirao',            label: 'Feirão',                roles: ['admin'], accent: true },
  { id: 'clients',           label: 'Clientes',              roles: ['admin', 'gerente', 'marketing'] },
  { id: 'heatmap',           label: 'Mapa de Calor',         roles: ['admin', 'gerente', 'marketing'] },
  { id: 'insights',          label: 'Insights IA',           roles: ['admin', 'gerente', 'marketing'], accent: true },
  { id: 'table',             label: 'Dados Detalhados',      roles: ['admin'] },
  { id: 'omie',             label: 'Omiê ERP',              roles: ['admin'], accent: true },
  { id: 'users',            label: 'Usuários',              roles: ['admin'] },
]

export function TabNav() {
  const { activeTab, setActiveTab } = useDashboardStore()
  const { user } = useAuth()

  // Filtra abas pelo role do usuário logado
  const tabs = ALL_TABS.filter(tab =>
    user && tab.roles.includes(user.role)
  )

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
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        const color  = active ? 'var(--accent)' : 'var(--text-secondary)'

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
            {tab.accent && tab.id === 'omie'              && <Wifi     size={11} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
