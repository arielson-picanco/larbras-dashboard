// ============================================================
// routes/sync.js — Endpoints de sincronização com Omiê
//
// POST /api/sync/run          → dispara sync manual (background)
// POST /api/sync/run-range    → sync de intervalo customizado
// GET  /api/sync/status       → estado e histórico
// GET  /api/sync/test         → testa conexão + retorna amostra
// DELETE /api/sync/reset      → zera last_synced_date (re-sync completo)
// ============================================================
const express  = require('express')
const supabase = require('../services/supabase')
const { runSync, runSyncRange } = require('../services/sync')
const { testConnection, formatDateBR } = require('../services/omie')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth, requireRole('admin'))

// ── POST /sync/run — Sync incremental automático ──────────────────────────────
router.post('/run', async (req, res) => {
  res.json({ message: 'Sincronização iniciada em background' })
  runSync().catch(err => console.error('[Sync manual] Erro:', err))
})

// ── POST /sync/run-range — Sync de período customizado ───────────────────────
router.post('/run-range', async (req, res) => {
  const { dateFrom, dateTo } = req.body
  if (!dateFrom || !dateTo)
    return res.status(400).json({ error: 'Informe dateFrom e dateTo (YYYY-MM-DD)' })

  const from = new Date(dateFrom)
  const to   = new Date(dateTo)
  if (isNaN(from) || isNaN(to))
    return res.status(400).json({ error: 'Datas inválidas' })

  res.json({ message: `Sync de ${dateFrom} a ${dateTo} iniciado em background` })
  runSyncRange(from, to).catch(err => console.error('[Sync range] Erro:', err))
})

// ── GET /sync/status — Estado + últimos 20 logs ───────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const [{ data: state, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
      supabase.from('sync_state').select('*').eq('id', 1).single(),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(20),
    ])

    if (e1 && e1.code !== 'PGRST116') throw e1  // PGRST116 = not found
    if (e2) throw e2

    res.json({ state: state || null, logs: logs || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /sync/test — Testar conexão com Omiê ─────────────────────────────────
router.get('/test', async (req, res) => {
  try {
    const { OMIE_APP_KEY, OMIE_APP_SECRET } = process.env
    if (!OMIE_APP_KEY || !OMIE_APP_SECRET)
      return res.status(400).json({ ok: false, error: 'OMIE_APP_KEY ou OMIE_APP_SECRET não configurados no .env' })

    // Busca os últimos 30 dias como amostra
    const today    = new Date()
    const thirtyAgo = new Date(today); thirtyAgo.setDate(today.getDate() - 30)

    const result = await testConnection(thirtyAgo, today)
    res.json(result)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── DELETE /sync/reset — Zera last_synced_date (próximo sync busca 90 dias) ──
router.delete('/reset', async (req, res) => {
  try {
    await supabase.from('sync_state').update({ last_synced_date: null }).eq('id', 1)
    res.json({ message: 'Estado de sync resetado. Próximo sync buscará os últimos 90 dias.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
