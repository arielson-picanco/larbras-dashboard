// ============================================================
// pages/LoginPage.tsx — Tela de login
// ============================================================
import { useState, FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { login }   = useAuth()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--bg-primary)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '1rem',
    }}>
      <div style={{
        background:    'var(--bg-card)',
        border:        '1px solid var(--border-subtle)',
        borderRadius:  16,
        padding:       '2.5rem',
        width:         '100%',
        maxWidth:      400,
        boxShadow:     'var(--shadow-modal)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width:          56, height: 56,
            borderRadius:   14,
            background:     'linear-gradient(135deg, #f5a623, #c07800)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       20,
            fontWeight:     900,
            color:          '#0b0d18',
            fontFamily:     "'IBM Plex Mono', monospace",
            margin:         '0 auto 1rem',
          }}>
            LB
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            LARBRAS
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Painel de Vendas — Acesso Restrito
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="input"
              style={{ fontSize: 14 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
              Senha
            </span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input"
                style={{ fontSize: 14, width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position:       'absolute',
                  right:          10,
                  top:            '50%',
                  transform:      'translateY(-50%)',
                  background:     'none',
                  border:         'none',
                  cursor:         'pointer',
                  color:          'var(--text-tertiary)',
                  display:        'flex',
                  alignItems:     'center',
                  padding:        4,
                  transition:     'color .15s',
                }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseOut={e  => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <div style={{
              padding:       '10px 14px',
              background:    'rgba(240,107,107,.1)',
              border:        '1px solid rgba(240,107,107,.3)',
              borderRadius:  8,
              fontSize:      12,
              color:         'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background:    loading ? 'var(--bg-card2)' : 'var(--accent)',
              border:        'none',
              color:         loading ? 'var(--text-tertiary)' : '#0b0d18',
              borderRadius:  10,
              padding:       '12px 0',
              fontSize:      14,
              fontWeight:    700,
              cursor:        loading ? 'not-allowed' : 'pointer',
              fontFamily:    'inherit',
              transition:    'all .15s',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              gap:           8,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width:  14, height: 14,
                  border: '2px solid var(--text-tertiary)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                Entrando…
              </>
            ) : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
