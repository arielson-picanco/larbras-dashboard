// ============================================================
// server.js — Servidor principal Express
// ============================================================
require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const config  = require('./config')
const { startSyncScheduler } = require('./services/sync')

// Rotas
const authRoutes  = require('./routes/auth')
const salesRoutes = require('./routes/sales')
const aiRoutes    = require('./routes/ai')
const syncRoutes  = require('./routes/sync')

const app = express()

// ── Middlewares globais ───────────────────────────────────────────────────────
app.use(cors({
  origin:      config.nodeEnv === 'production'
    ? process.env.FRONTEND_URL  // ex: https://larbras.vercel.app
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    env:     config.nodeEnv,
    time:    new Date().toISOString(),
  })
})

// ── Rotas da API ──────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/ai',    aiRoutes)
app.use('/api/sync',  syncRoutes)

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({ error: 'Erro interno no servidor' })
})

// ── Iniciar servidor ──────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🚀 LARBRAS Backend rodando em http://localhost:${config.port}`)
  console.log(`   Ambiente: ${config.nodeEnv}`)
  console.log(`   Supabase: ${config.supabase.url}`)
  console.log(`   Omiê:     ${config.omie.appKey ? '✓ configurado' : '✗ não configurado'}`)
  console.log(`   IAs:      Gemini ${config.ai.geminiKey ? '✓' : '✗'}  Groq ${config.ai.groqKey ? '✓' : '✗'}  Claude ${config.ai.anthropicKey ? '✓' : '✗'}`)

  // Inicia o cron de sync às 06:00 Manaus
  if (config.omie.appKey) {
    startSyncScheduler()
    console.log(`   Sync:     Agendado às 06:00 (America/Manaus)`)
  } else {
    console.log(`   Sync:     ⚠ Desativado (configure OMIE_APP_KEY)`)
  }
  console.log()
})
