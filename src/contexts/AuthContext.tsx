// ============================================================
// contexts/AuthContext.tsx — Estado global de autenticação
// ============================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AuthUser {
  id:    string
  email: string
  name:  string
  role:  'admin' | 'gerente' | 'marketing'
}

interface AuthContextType {
  user:    AuthUser | null
  token:   string | null
  loading: boolean
  login:   (email: string, password: string) => Promise<void>
  logout:  () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Usa URL relativa (/api) para passar pelo proxy do Vite em dev
// e funcionar no mesmo domínio em produção — sem CORS
const API_BASE = '/api'
const TOKEN_KEY = 'larbras_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sessão do localStorage no carregamento
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      verifyToken(saved).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function verifyToken(t: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) throw new Error('Token inválido')
      const data = await res.json()
      setToken(t)
      setUser(data.user)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login')

    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
