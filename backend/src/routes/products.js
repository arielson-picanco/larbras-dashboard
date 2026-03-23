// ============================================================
// routes/products.js — Catálogo de produtos do Omiê
//
// GET /api/products
//   Retorna todos os produtos cadastrados no Omiê independentemente
//   de terem vendas. Usado nas abas Comparação e Markup/Preços.
//
// Autenticação: requireAuth (todos os usuários logados podem ler)
// ============================================================
const express   = require('express')
const router    = express.Router()
const omie      = require('../services/omie')
const { requireAuth } = require('../middleware/auth')

// Cache em memória: evita chamar o Omiê em cada request de página.
// TTL de 10 minutos (produtos mudam raramente).
let cache = null
let cacheAt = 0
const CACHE_TTL = 10 * 60 * 1000   // 10 min

// GET /api/products
router.get('/', requireAuth, async (req, res) => {
  try {
    // Usa cache se ainda válido
    if (cache && (Date.now() - cacheAt) < CACHE_TTL) {
      return res.json({ ok: true, products: cache, cached: true, count: cache.length })
    }

    if (!require('../config').omie.appKey || !require('../config').omie.appSecret) {
      return res.status(400).json({
        ok: false,
        error: 'Credenciais do Omiê não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET)',
      })
    }

    const products = await omie.fetchAllProductsCatalog()
    cache   = products
    cacheAt = Date.now()

    res.json({ ok: true, products, cached: false, count: products.length })
  } catch (err) {
    console.error('[Products] Erro:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/products/clear-cache
router.post('/clear-cache', requireAuth, (req, res) => {
  cache = null
  cacheAt = 0
  res.json({ ok: true, message: 'Cache de produtos limpo' })
})

module.exports = router
