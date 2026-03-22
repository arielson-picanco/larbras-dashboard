// ============================================================
// routes/sync.js — Endpoints de sincronização manual e status
//
// POST /api/sync/run    → dispara sync manual (admin)
// GET  /api/sync/status → status e histórico (admin)
// ============================================================
const express  = require('express')
const supabase = require('../services/supabase')
const { runSync } = require('../services/sync')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

// Somente admin acessa endpoints de sync
router.use(requireAuth, requireRole('admin'))

// ── POST /sync/run — Disparar sync manual ─────────────────────────────────────
router.post('/run', async (req, res) => {
  // Responde imediatamente — sync roda em background
  res.json({ message: 'Sincronização iniciada em background' })
  runSync().catch(err => console.error('[Sync manual] Erro:', err))
})

// ── GET /sync/status — Estado e últimos logs ──────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const [{ data: state }, { data: logs }] = await Promise.all([
      supabase.from('sync_state').select('*').eq('id', 1).single(),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(10),
    ])

    res.json({ state, logs: logs || [] })

  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar status do sync' })
  }
})

module.exports = router
