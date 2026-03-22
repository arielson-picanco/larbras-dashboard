// ============================================================
// middleware/auth.js — Verificação de JWT em todas as rotas protegidas
// ============================================================
const jwt      = require('jsonwebtoken')
const supabase = require('../services/supabase')
const config   = require('../config')

// ── Verificar token JWT ───────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação necessário' })
  }

  const token = header.slice(7)

  try {
    const payload = jwt.verify(token, config.jwt.secret)
    req.user = payload  // { userId, email, name, role }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

// ── Verificar role específico ─────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Acesso negado. Role necessário: ${roles.join(' ou ')}` })
    }
    next()
  }
}

module.exports = { requireAuth, requireRole }
