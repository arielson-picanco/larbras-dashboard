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
const syncRoutes     = require('./routes/sync')
const productsRoutes = require('./routes/products')

const app = express()

// ── Middlewares globais ───────────────────────────────────────────────────────

// Origens permitidas em desenvolvimento:
//   - 5173: Vite dev server (porta padrão — era a causa do "Rota não encontrada")
//   - 5174: Vite quando a 5173 já está ocupada (porta alternativa automática)
//   - 3000: CRA / outros frameworks
//   - 3001: próprio backend (chamadas internas / testes com curl)
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3001',
]

app.use(cors({
  origin: (origin, callback) => {
    // Sem origin = curl / Postman / chamadas server-side — permite sempre
    if (!origin) return callback(null, true)

    if (config.nodeEnv === 'production') {
      const allowed = process.env.FRONTEND_URL
      if (origin === allowed) return callback(null, true)
      return callback(new Error(`CORS bloqueado: ${origin}`))
    }

    // Desenvolvimento: qualquer localhost em qualquer porta é permitido
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`CORS bloqueado: ${origin}`))
  },
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
app.use('/api/sync',     syncRoutes)
app.use('/api/products', productsRoutes)

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:  'Rota não encontrada',
    path:   req.originalUrl,
    method: req.method,
  })
})

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Erros de CORS chegam aqui com a mensagem do callback acima
  if (err.message && err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ error: err.message })
  }
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

  if (config.nodeEnv === 'development') {
    console.log(`   CORS dev: localhost:* (todas as portas)`)
  }

  // Inicia o cron de sync às 06:00 Manaus
  if (config.omie.appKey) {
    startSyncScheduler()
    console.log(`   Sync:     Agendado às 06:00 (America/Manaus)`)
  } else {
    console.log(`   Sync:     ⚠ Desativado (configure OMIE_APP_KEY)`)
  }
  console.log()
})
