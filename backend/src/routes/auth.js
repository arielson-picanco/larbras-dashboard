// ============================================================
// routes/auth.js — Login, logout e gestão de usuários
//
// POST /api/auth/login      → { email, password } → { token, user }
// GET  /api/auth/me         → user profile (autenticado)
// POST /api/auth/users      → criar usuário (somente admin)
// GET  /api/auth/users      → listar usuários (somente admin)
// PATCH /api/auth/users/:id → editar usuário (somente admin)
// DELETE /api/auth/users/:id→ desativar usuário (somente admin)
// ============================================================
const express  = require('express')
const jwt      = require('jsonwebtoken')
const supabase = require('../services/supabase')
const config   = require('../config')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  try {
    // Autentica via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' })
    }

    // Busca perfil com role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, role, active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Perfil de usuário não encontrado' })
    }

    if (!profile.active) {
      return res.status(403).json({ error: 'Usuário desativado. Contate o administrador.' })
    }

    // Gera JWT próprio (independente do token do Supabase)
    const token = jwt.sign(
      {
        userId: authData.user.id,
        email:  authData.user.email,
        name:   profile.name,
        role:   profile.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )

    res.json({
      token,
      user: {
        id:    authData.user.id,
        email: authData.user.email,
        name:  profile.name,
        role:  profile.role,
      },
    })

  } catch (err) {
    console.error('/login error:', err)
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ── POST /users — Criar usuário (admin) ────────────────────────────────────────
router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, password, name, role } = req.body

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name e role são obrigatórios' })
  }

  if (!['admin', 'gerente', 'marketing'].includes(role)) {
    return res.status(400).json({ error: 'Role inválido. Use: admin, gerente ou marketing' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' })
  }

  try {
    // Cria usuário no Supabase Auth
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // pula confirmação de email
      user_metadata: { name, role },
    })

    if (createError) {
      if (createError.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email já cadastrado' })
      }
      throw createError
    }

    // O trigger handle_new_user cria o perfil automaticamente
    // Mas garantimos aqui caso o trigger não esteja ativo
    await supabase
      .from('profiles')
      .upsert({ id: newUser.user.id, name, role, active: true })

    res.status(201).json({
      user: {
        id:    newUser.user.id,
        email: newUser.user.email,
        name,
        role,
      },
    })

  } catch (err) {
    console.error('/users POST error:', err)
    res.status(500).json({ error: err.message || 'Erro ao criar usuário' })
  }
})

// ── GET /users — Listar usuários (admin) ──────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, role, active, created_at')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Busca emails do Supabase Auth para incluir na lista
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const emailMap = {}
    authUsers?.users?.forEach(u => { emailMap[u.id] = u.email })

    const users = profiles.map(p => ({
      ...p,
      email: emailMap[p.id] || '',
    }))

    res.json({ users })

  } catch (err) {
    console.error('/users GET error:', err)
    res.status(500).json({ error: 'Erro ao listar usuários' })
  }
})

// ── PATCH /users/:id — Editar role ou status (admin) ──────────────────────────
router.patch('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const { name, role, active } = req.body

  if (role && !['admin', 'gerente', 'marketing'].includes(role)) {
    return res.status(400).json({ error: 'Role inválido' })
  }

  try {
    const updates = {}
    if (name   !== undefined) updates.name   = name
    if (role   !== undefined) updates.role   = role
    if (active !== undefined) updates.active = active

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)

    if (error) throw error

    res.json({ success: true })

  } catch (err) {
    console.error('/users PATCH error:', err)
    res.status(500).json({ error: 'Erro ao atualizar usuário' })
  }
})

module.exports = router
