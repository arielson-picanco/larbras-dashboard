// ============================================================
// routes/sales.js — Dados de vendas
//
// GET  /api/sales           → todos os dados (filtros via query params)
// POST /api/sales/upload    → importação XLSX (admin)
// DELETE /api/sales/upload  → limpar dados importados via upload (admin)
// ============================================================
const express  = require('express')
const multer   = require('multer')
const XLSX     = require('xlsx')
const supabase = require('../services/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')

const router  = express.Router()
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ── GET /sales — Retornar dados para o frontend ───────────────────────────────
// O frontend recebe os dados crus e faz a análise client-side (buildDerived)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, limit } = req.query

    let query = supabase
      .from('sales')
      .select('data, valor, cliente, produto, marca, vendedor, bairro, quantidade, source')
      .order('data', { ascending: true })

    if (dateFrom) query = query.gte('data', dateFrom)
    if (dateTo)   query = query.lte('data', dateTo)
    if (limit)    query = query.limit(parseInt(limit))

    // Vendedor só vê os próprios pedidos
    if (req.user.role === 'vendedor') {
      query = query.eq('vendedor', req.user.name)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Converte para o formato SaleRow esperado pelo frontend
    const rows = (data || []).map(row => ({
      _val:      parseFloat(row.valor),
      _cliente:  row.cliente,
      _bairro:   row.bairro,
      _produto:  row.produto,
      _marca:    row.marca,
      _vendedor: row.vendedor,
      _qtd:      row.quantidade,
      _date:     row.data,   // string YYYY-MM-DD — o store converte
      _raw:      {},
    }))

    res.json({ rows, total: rows.length })

  } catch (err) {
    console.error('/sales GET error:', err)
    res.status(500).json({ error: 'Erro ao buscar dados de vendas' })
  }
})

// ── POST /sales/upload — Importar XLSX (admin) ────────────────────────────────
router.post('/upload', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não enviado' })
  }

  try {
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' })

    if (!json.length) {
      return res.status(400).json({ error: 'Planilha vazia' })
    }

    // Auto-detecção de colunas (mesmo mapa de sinônimos do parser.ts)
    const headers = Object.keys(json[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''))

    const findCol = (syns) => {
      const origHeaders = Object.keys(json[0])
      for (const syn of syns) {
        const idx = headers.findIndex(h => h === syn || h.includes(syn))
        if (idx >= 0) return origHeaders[idx]
      }
      return null
    }

    const cols = {
      data:     findCol(['data', 'datavenda', 'datapedido', 'dtvenda', 'date']),
      valor:    findCol(['totalmercadoria', 'totalvenda', 'valor', 'total', 'receita', 'faturamento']),
      cliente:  findCol(['cliente', 'razaosocial', 'nomecliente', 'customer', 'nome']),
      produto:  findCol(['descricaodoproduto', 'descricao', 'produto', 'product', 'item']),
      marca:    findCol(['marca', 'brand', 'fabricante', 'fornecedor']),
      vendedor: findCol(['vendedor', 'consultor', 'atendente', 'operador', 'seller']),
      bairro:   findCol(['bairro', 'localidade', 'regiao', 'cidade', 'zona']),
      qtd:      findCol(['quantidade', 'qtd', 'qty', 'volume', 'unidades']),
    }

    if (!cols.valor) {
      return res.status(400).json({ error: 'Coluna de valor não encontrada. Verifique o mapeamento.' })
    }

    const parseNum = (v) => {
      if (typeof v === 'number') return v
      const s = String(v || '').trim().replace(/R\$\s*/i, '')
      if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+(,\d{1,2})$/.test(s)) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
      }
      return parseFloat(s.replace(/,/g, '')) || 0
    }

    const parseDate = (v) => {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      const s = String(v).trim()
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
      if (m) {
        const year = +m[3] < 100 ? +m[3] + 2000 : +m[3]
        return `${year}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`
      }
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
      return null
    }

    const rows = json
      .map((r, idx) => {
        const valor = parseNum(cols.valor ? r[cols.valor] : 0)
        if (valor <= 0) return null
        const data = parseDate(cols.data ? r[cols.data] : null)
        if (!data) return null

        return {
          omie_id:    null,  // null = importação manual (não conflita com Omiê)
          data,
          valor,
          cliente:    cols.cliente  ? String(r[cols.cliente]  || 'Anônimo').trim() : 'Anônimo',
          produto:    cols.produto  ? String(r[cols.produto]  || 'Produto').trim() : 'Produto',
          marca:      cols.marca    ? String(r[cols.marca]    || 'S/Marca').trim() : 'S/Marca',
          vendedor:   cols.vendedor ? String(r[cols.vendedor] || 'N/A').trim()     : 'N/A',
          bairro:     cols.bairro   ? String(r[cols.bairro]   || 'N/I').trim()     : 'N/I',
          quantidade: cols.qtd ? (Math.round(parseNum(r[cols.qtd])) || 1) : 1,
          source:     'upload',
        }
      })
      .filter(Boolean)

    if (!rows.length) {
      return res.status(400).json({ error: 'Nenhuma linha válida encontrada na planilha' })
    }

    // Para upload, opção replace ou append
    const mode = req.query.mode || 'append'
    if (mode === 'replace') {
      // Remove apenas registros de upload anterior (mantém dados do Omiê)
      await supabase.from('sales').delete().eq('source', 'upload')
    }

    // Insert em lotes
    const BATCH = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('sales')
        .insert(rows.slice(i, i + BATCH))
      if (error) throw error
      inserted += rows.slice(i, i + BATCH).length
    }

    res.json({ success: true, inserted })

  } catch (err) {
    console.error('/sales/upload error:', err)
    res.status(500).json({ error: err.message || 'Erro ao processar arquivo' })
  }
})

// ── DELETE /sales/upload — Limpar dados importados (admin) ────────────────────
router.delete('/upload', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase.from('sales').delete().eq('source', 'upload')
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao limpar dados' })
  }
})

module.exports = router
