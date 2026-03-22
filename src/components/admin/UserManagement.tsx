// ============================================================
// components/admin/UserManagement.tsx — Gerenciamento de usuários
// Permite admin criar, editar role/nome, ativar/desativar usuários
// ============================================================
import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { apiFetch } from '@/services/api'
import {
  UserPlus, Edit2, UserX, UserCheck, RefreshCw,
  Shield, Eye, EyeOff, ChevronDown, X, Check,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface User {
  id:         string
  email:      string
  name:       string
  role:       'admin' | 'gerente' | 'marketing'
  active:     boolean
  created_at: string
}

const ROLES: User['role'][] = ['admin', 'gerente', 'marketing']
const ROLE_LABEL: Record<User['role'], string> = {
  admin:     'Administrador',
  gerente:   'Gerente',
  marketing: 'Marketing',
}
const ROLE_COLOR: Record<User['role'], { color: string; bg: string }> = {
  admin:     { color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
  gerente:   { color: '#60a5fa', bg: 'rgba(96,165,250,.12)' },
  marketing: { color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RoleBadge({ role }: { role: User['role'] }) {
  const { color, bg } = ROLE_COLOR[role]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, color, background: bg,
    }}>
      <Shield size={10} /> {ROLE_LABEL[role]}
    </span>
  )
}

// ── Modal de criar/editar usuário ─────────────────────────────────────────────
interface UserModalProps {
  user?: User
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, ok?: boolean) => void
}

function UserModal({ user, onClose, onSaved, showToast }: UserModalProps) {
  const isEdit = !!user
  const [name,     setName]     = useState(user?.name     || '')
  const [email,    setEmail]    = useState(user?.email    || '')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<User['role']>(user?.role || 'gerente')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim())         e.name     = 'Nome obrigatório'
    if (!isEdit && !email.trim())  e.email    = 'Email obrigatório'
    if (!isEdit && password.length < 6) e.password = 'Mínimo 6 caracteres'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    try {
      if (isEdit) {
        await apiFetch(`/auth/users/${user!.id}`, {
          method: 'PATCH',
          body:   JSON.stringify({ name: name.trim(), role }),
        })
        showToast(`Usuário ${name} atualizado!`)
      } else {
        await apiFetch('/auth/users', {
          method: 'POST',
          body:   JSON.stringify({ email: email.trim(), password, name: name.trim(), role }),
        })
        showToast(`Usuário ${name} criado com sucesso!`)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      showToast((err as Error).message, false)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: CSSProperties = {
    background: 'var(--bg-card2)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, padding: '9px 12px', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box',
  }

  const errStyle: CSSProperties = {
    fontSize: 11, color: '#f06b6b', marginTop: 4,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 440,
        boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,.4))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            {isEdit ? `Editar — ${user!.name}` : 'Novo Usuário'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nome */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Nome
            </label>
            <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              placeholder="Nome completo" style={{ ...inputStyle, borderColor: errors.name ? '#f06b6b' : undefined }} />
            {errors.name && <div style={errStyle}>{errors.name}</div>}
          </div>

          {/* Email — somente criação */}
          {!isEdit && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                placeholder="usuario@larbras.com" style={{ ...inputStyle, borderColor: errors.email ? '#f06b6b' : undefined }} />
              {errors.email && <div style={errStyle}>{errors.email}</div>}
            </div>
          )}

          {/* Senha — somente criação */}
          {!isEdit && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...inputStyle, paddingRight: 40, borderColor: errors.password ? '#f06b6b' : undefined }} />
                <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <div style={errStyle}>{errors.password}</div>}
            </div>
          )}

          {/* Role */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Função
            </label>
            <div style={{ position: 'relative' }}>
              <select value={role} onChange={e => setRole(e.target.value as User['role'])}
                style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <RoleBadge role={role} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                {role === 'admin'     && 'Acesso total ao sistema'}
                {role === 'gerente'   && 'Vendas, produtos, clientes e mapa'}
                {role === 'marketing' && 'Produtos, clientes e insights'}
              </span>
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', background: 'var(--bg-card2)',
              border: '1px solid var(--border-subtle)', borderRadius: 9,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading} style={{
              flex: 2, padding: '10px', background: 'var(--accent)',
              border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', color: '#0b0d18',
              fontFamily: 'inherit', opacity: loading ? .7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Check size={14} />
              {loading ? 'Salvando…' : isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function UserManagement() {
  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'create' | User | null>(null)
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: User[] }>('/auth/users')
      setUsers(data.users || [])
    } catch (err: unknown) {
      showToast((err as Error).message, false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleActive(user: User) {
    const action = user.active ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${action} o usuário ${user.name}?`)) return
    try {
      await apiFetch(`/auth/users/${user.id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ active: !user.active }),
      })
      showToast(`Usuário ${user.active ? 'desativado' : 'reativado'} com sucesso.`)
      fetchUsers()
    } catch (err: unknown) {
      showToast((err as Error).message, false)
    }
  }

  const cardStyle: CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: '1.25rem', marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 16,
    transition: 'border-color .15s',
    opacity: 1,
  }

  const btnStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card2)', color: 'var(--text-secondary)', transition: 'all .15s',
  }

  const active = users.filter(u => u.active)
  const inactive = users.filter(u => !u.active)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 0' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.ok ? '#4ade80' : '#f06b6b',
          color: toast.ok ? '#0b0d18' : '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Usuários do Sistema
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {active.length} ativo{active.length !== 1 ? 's' : ''} · {users.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchUsers} style={{ ...btnStyle }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setModal('create')} style={{
            ...btnStyle, background: 'var(--accent)', color: '#0b0d18',
            border: 'none', fontWeight: 700,
          }}>
            <UserPlus size={13} /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Lista de usuários ativos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          Carregando usuários…
        </div>
      ) : (
        <>
          {active.map(user => (
            <div key={user.id} style={cardStyle}>
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: ROLE_COLOR[user.role].bg,
                border: `1px solid ${ROLE_COLOR[user.role].color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: ROLE_COLOR[user.role].color,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {user.email}
                </div>
              </div>

              {/* Role + data */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <RoleBadge role={user.role} />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  desde {fmtDate(user.created_at)}
                </div>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setModal(user)} style={{ ...btnStyle, padding: '6px 10px' }}
                  title="Editar">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => toggleActive(user)}
                  style={{ ...btnStyle, padding: '6px 10px', color: '#f06b6b', borderColor: 'rgba(240,107,107,.3)' }}
                  title="Desativar">
                  <UserX size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Inativos */}
          {inactive.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-tertiary)', margin: '1.5rem 0 .75rem' }}>
                Inativos ({inactive.length})
              </div>
              {inactive.map(user => (
                <div key={user.id} style={{ ...cardStyle, opacity: .55 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: 'var(--bg-card2)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 800, color: 'var(--text-tertiary)',
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {user.email}
                    </div>
                  </div>
                  <RoleBadge role={user.role} />
                  <button onClick={() => toggleActive(user)}
                    style={{ ...btnStyle, padding: '6px 10px', color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}
                    title="Reativar">
                    <UserCheck size={13} />
                  </button>
                </div>
              ))}
            </>
          )}

          {users.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Nenhum usuário encontrado. Crie o primeiro clicando em "Novo Usuário".
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <UserModal
          user={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={fetchUsers}
          showToast={showToast}
        />
      )}
    </div>
  )
}
