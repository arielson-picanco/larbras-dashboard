// ============================================================
// MÓDULO 3 — Componente Header
// ============================================================

import { Moon, Sun, Upload, Trash2, RefreshCw, LogOut } from 'lucide-react'
import { useDashboardStore }  from '@/store/useDashboardStore'
import { clearRows }          from '@/services/db'
import { useAuth }             from '@/contexts/AuthContext'
import { formatDate }         from '@/services/analytics'

export function Header() {
  const {
    theme, toggleTheme,
    openImportModal,
    lastImport,
    allRows,
    clearData,
    isLoading,
  } = useDashboardStore()
  const { user, logout } = useAuth()

  const handleClear = async () => {
    if (!confirm('Remover todos os dados importados?')) return
    await clearRows()
    clearData()
  }

  return (
    <header
      style={{
        background:   'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        height:       52,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        padding:      '0 1.5rem',
        position:     'sticky',
        top:          0,
        zIndex:       300,
        gap:          12,
        transition:   'background .2s, border-color .2s',
      }}
    >
      {/* ── Left: Logo + title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div
          style={{
            width:        32,
            height:       32,
            borderRadius: 8,
            background:   'linear-gradient(135deg, #f5a623, #c07800)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     13,
            fontWeight:   900,
            color:        '#0b0d18',
            flexShrink:   0,
            fontFamily:   "'IBM Plex Mono', monospace",
          }}
        >
          LB
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            LARBRAS
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Painel de Vendas
          </div>
        </div>
      </div>

      {/* ── Right: controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Last import badge */}
        {lastImport && (
          <span
            style={{
              background:   'var(--accent-muted)',
              border:       '1px solid rgba(245,166,35,.2)',
              color:        'var(--accent)',
              borderRadius: 6,
              padding:      '4px 10px',
              fontSize:     10,
              fontWeight:   600,
              whiteSpace:   'nowrap',
              fontFamily:   "'IBM Plex Mono', monospace",
            }}
          >
            {allRows.length.toLocaleString('pt-BR')} registros
            {' · '}
            {formatDate(new Date(lastImport))}
          </span>
        )}

        {/* Clear data */}
        {allRows.length > 0 && (
          <button
            onClick={handleClear}
            title="Remover dados"
            style={{
              background:   'transparent',
              border:       '1px solid var(--border-default)',
              color:        'var(--text-secondary)',
              borderRadius: 7,
              padding:      '6px 8px',
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          4,
              fontSize:     11,
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
            <Trash2 size={13} />
          </button>
        )}

        {/* Import button — somente admin */}
        {user?.role === 'admin' && <button
          onClick={openImportModal}
          disabled={isLoading}
          style={{
            background:   'var(--accent)',
            border:       '1px solid var(--accent)',
            color:        '#0b0d18',
            borderRadius: 7,
            padding:      '6px 14px',
            fontFamily:   'inherit',
            fontSize:     11,
            fontWeight:   700,
            cursor:       isLoading ? 'not-allowed' : 'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          5,
            opacity:      isLoading ? 0.7 : 1,
            whiteSpace:   'nowrap',
            transition:   'all .15s',
          }}
          onMouseOver={(e) => {
            if (!isLoading) e.currentTarget.style.background = 'var(--accent-hover)'
          }}
          onMouseOut={(e) => {
            if (!isLoading) e.currentTarget.style.background = 'var(--accent)'
          }}
        >
          {isLoading
            ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Upload size={13} />
          }
          {isLoading ? 'Processando…' : 'Importar dados'}
        </button>}

        {/* User info + logout */}
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              background:   'var(--bg-card2)',
              border:       '1px solid var(--border-subtle)',
              borderRadius: 7,
              padding:      '4px 10px',
              fontSize:     11,
              color:        'var(--text-secondary)',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
            }}>
              <span style={{
                fontSize:     9,
                fontWeight:   700,
                textTransform:'uppercase',
                letterSpacing:'.6px',
                padding:      '2px 6px',
                borderRadius: 4,
                background:   user.role === 'admin' ? 'rgba(240,107,107,.15)' : user.role === 'gerente' ? 'rgba(91,141,238,.15)' : 'rgba(34,211,160,.15)',
                color:        user.role === 'admin' ? '#f06b6b' : user.role === 'gerente' ? '#5b8dee' : '#22d3a0',
              }}>
                {user.role}
              </span>
              {user.name}
            </div>
            <button
              onClick={logout}
              title="Sair"
              style={{
                background:   'transparent',
                border:       '1px solid var(--border-default)',
                color:        'var(--text-secondary)',
                borderRadius: 7,
                padding:      '6px 8px',
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                transition:   'all .15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor='var(--danger)'; e.currentTarget.style.color='var(--danger)' }}
              onMouseOut={(e)  => { e.currentTarget.style.borderColor='var(--border-default)'; e.currentTarget.style.color='var(--text-secondary)' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title="Alternar tema"
          style={{
            width:        32,
            height:       32,
            borderRadius: '50%',
            background:   'var(--bg-card2)',
            border:       '1px solid var(--border-default)',
            color:        'var(--text-primary)',
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
            transition:   'all .15s',
          }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  )
}
