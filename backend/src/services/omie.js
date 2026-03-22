// ============================================================
// services/omie.js — Cliente da API do Omiê ERP
//
// A API do Omiê usa POST com estrutura { call, app_key, app_secret, param }
// Endpoint: https://app.omie.com.br/api/v1/produtos/pedido/
// Call:     ListarPedidos
//
// Cada pedido tem itens (det[]) — achatamos em SaleRows individuais
// ============================================================
const fetch  = require('node-fetch')
const config = require('../config')

const OMIE_BASE = config.omie.baseUrl

// ── Chamada genérica à API do Omiê ────────────────────────────────────────────
async function omieCall(endpoint, call, param) {
  const body = {
    call,
    app_key:    config.omie.appKey,
    app_secret: config.omie.appSecret,
    param:      [param],
  }

  const res = await fetch(`${OMIE_BASE}${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Omiê HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json()

  // Omiê retorna erros com faultcode/faultstring
  if (data.faultstring) {
    throw new Error(`Omiê API: ${data.faultstring}`)
  }

  return data
}

// ── Formatar data DD/MM/YYYY ───────────────────────────────────────────────────
function formatDateBR(date) {
  const d = date instanceof Date ? date : new Date(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// ── Parsear data DD/MM/YYYY → Date ────────────────────────────────────────────
function parseDateBR(str) {
  if (!str) return null
  const [dd, mm, yyyy] = str.split('/')
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
}

// ── Buscar página de pedidos ──────────────────────────────────────────────────
async function fetchPedidosPage(dateFrom, dateTo, page) {
  return omieCall('/produtos/pedido/', 'ListarPedidos', {
    nPagina:        page,
    nRegPorPagina:  config.omie.pageSize,
    dDtPedido:      formatDateBR(dateFrom),
    dDtPedidoFim:   formatDateBR(dateTo),
    // cEtapa: '60' — apenas faturados. Remova para buscar todos os status
    cEtapa:         '60',
  })
}

// ── Converter pedido Omiê → array de SaleRows ─────────────────────────────────
// Um pedido pode ter N itens — cada item vira uma SaleRow
function pedidoToSaleRows(pedido) {
  const cab  = pedido.cabecalho              || {}
  const info = pedido.informacoes_adicionais || {}
  const det  = pedido.det                    || []

  const nCodPed  = String(cab.nCodPed     || '')
  const data     = parseDateBR(cab.dDtPedido)
  const vendedor = info.cNomeVendedor || cab.cNomeVendedor || 'N/A'
  const cliente  = info.cNomeCliente  || cab.cRazaoSocial  || 'Anônimo'
  const bairro   = info.cBairro       || info.cCidade       || 'N/I'

  if (!data || !nCodPed) return []

  return det.map((item, idx) => {
    const prod = item.produto || item.detalhe || {}

    // Campos do produto — nomes podem variar; mapeamos os mais comuns
    const produto    = prod.cDescricao  || prod.cNomeProd || prod.cDescrProd || 'Produto'
    const marca      = prod.cNomeFamilia || prod.cFamilia  || 'S/Marca'
    const quantidade = parseFloat(prod.nQtdPedido  || prod.nQtde    || 1)   || 1
    const valor      = parseFloat(prod.nValorTotal || prod.nVlrTotal || 0)

    // Ignora itens sem valor
    if (valor <= 0) return null

    return {
      omie_id:    `${nCodPed}-${idx}`,  // único por pedido+item
      data:       data.toISOString().slice(0, 10),  // YYYY-MM-DD
      valor,
      cliente,
      produto,
      marca,
      vendedor,
      bairro,
      quantidade: Math.round(quantidade),
      source:     'omie',
    }
  }).filter(Boolean)
}

// ── Buscar todos os pedidos de um período ─────────────────────────────────────
// Pagina automaticamente até obter todos os registros
async function fetchAllPedidos(dateFrom, dateTo) {
  console.log(`[Omiê] Buscando pedidos de ${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`)

  const rows = []
  let page   = 1
  let total  = null

  while (true) {
    const data = await fetchPedidosPage(dateFrom, dateTo, page)

    const pedidos = data.pedido_venda_produto || []
    if (total === null) {
      total = data.nTotRegistros || 0
      console.log(`[Omiê] Total de pedidos encontrados: ${total} (${data.nTotPaginas || 1} páginas)`)
    }

    for (const pedido of pedidos) {
      rows.push(...pedidoToSaleRows(pedido))
    }

    if (page >= (data.nTotPaginas || 1) || pedidos.length === 0) break

    page++
    // Pequeno delay entre páginas para respeitar rate limit do Omiê
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`[Omiê] ${rows.length} linhas de venda extraídas`)
  return rows
}

module.exports = { fetchAllPedidos, formatDateBR, parseDateBR }
