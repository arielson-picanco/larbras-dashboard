// ============================================================
// routes/ai.js — Proxy para APIs de IA
// As chaves ficam no backend — nunca expostas ao browser
//
// POST /api/ai/claude  → Anthropic Claude
// POST /api/ai/gemini  → Google Gemini
// POST /api/ai/groq    → Groq
// ============================================================
const express = require('express')
const fetch   = require('node-fetch')
const config  = require('../config')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// Todos os endpoints de IA requerem autenticação
router.use(requireAuth)

// ── POST /ai/claude ───────────────────────────────────────────────────────────
router.post('/claude', async (req, res) => {
  if (!config.ai.anthropicKey) {
    return res.status(503).json({ error: 'Claude não configurado no servidor' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 config.ai.anthropicKey,
        'anthropic-version':                         '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()
    res.status(response.status).json(data)

  } catch (err) {
    res.status(502).json({ error: `Erro ao chamar Claude: ${err.message}` })
  }
})

// ── POST /ai/gemini ───────────────────────────────────────────────────────────
router.post('/gemini', async (req, res) => {
  if (!config.ai.geminiKey) {
    return res.status(503).json({ error: 'Gemini não configurado no servidor' })
  }

  const { model = 'gemini-2.5-flash', ...body } = req.body

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.geminiKey}`
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const data = await response.json()
    res.status(response.status).json(data)

  } catch (err) {
    res.status(502).json({ error: `Erro ao chamar Gemini: ${err.message}` })
  }
})

// ── POST /ai/groq ─────────────────────────────────────────────────────────────
router.post('/groq', async (req, res) => {
  if (!config.ai.groqKey) {
    return res.status(503).json({ error: 'Groq não configurado no servidor' })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.ai.groqKey}`,
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()
    res.status(response.status).json(data)

  } catch (err) {
    res.status(502).json({ error: `Erro ao chamar Groq: ${err.message}` })
  }
})

module.exports = router
