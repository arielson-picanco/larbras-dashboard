// ============================================================
// services/omie.js — Cliente da API do Omiê ERP (v7 - definitivo)
//
// IMPORTANTE: O Omiê tem duas gerações de API com nomenclaturas diferentes:
//
// GERAÇÃO NOVA (snake_case)  — /produtos/pedido/
//   Parâmetros: pagina, registros_por_pagina, filtrar_por_data_de, filtrar_por_data_ate
//
// GERAÇÃO ANTIGA (húngara)   — /geral/vendedores/, /geral/clientes/
//   Parâmetros: nPagina, nRegPorPagina
//   Resposta vendedor: nCodVend, cNomeVend
//   Resposta cliente:  codigo_cliente | nCodCli, razao_social | cRazaoSocial, cBairro, cCidade
//
// O campo codVend em informacoes_adicionais do pedido é o nCodVend do vendedor.
// ============================================================
const fetch  = require('node-fetch')
const config = require('../config')

const OMIE_BASE = config.omie.baseUrl

// ── Chamada genérica ──────────────────────────────────────────────────────────
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
    throw new Error(`Omiê HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }

  const data = await res.json()
  if (data.faultstring) {
    throw new Error(`Omiê API (${data.faultcode || 'ERR'}): ${data.faultstring}`)
  }
  return data
}

// ── Helpers de data ───────────────────────────────────────────────────────────
function formatDateBR(date) {
  const d  = date instanceof Date ? date : new Date(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function parseDateBR(str) {
  if (!str) return null
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  return isNaN(d.getTime()) ? null : d
}



// ── Mapa de Vendedores: String(codigo) → nome ────────────────────────────────
// Endpoint: /geral/vendedores/  Call: ListarVendedores
// Parâmetros: pagina, registros_por_pagina (snake_case — confirmado na doc oficial)
// Resposta: vendListarResponse → cadastro[] → { codigo, nome, inativo }
// O campo codVend em informacoes_adicionais do pedido = cadastro.codigo
async function fetchVendedoresMap() {
  const map = {}
  let page = 1, totalPages = 1

  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/vendedores/', 'ListarVendedores', {
        pagina:               page,
        registros_por_pagina: 50,
      })
      totalPages = data.total_de_paginas || 1
      const lista = data.cadastro || []  // campo correto conforme doc: "cadastro cadastroArray"
      for (const v of lista) {
        const codigo = String(v.codigo || '')
        const nome   = (v.nome || '').trim()
        if (codigo && nome) map[codigo] = nome
      }
      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) {
      console.warn('[Omiê] ListarVendedores erro:', err.message)
      break
    }
  }

  console.log(`[Omiê] ${Object.keys(map).length} vendedores carregados`)
  return map
}

// ── Mapa de Clientes: String(codigo_cliente_omie) → { nome, bairro } ────────
// Endpoint: /geral/clientes/  Call: ListarClientes
// Parâmetros (clientes_list_request): pagina, registros_por_pagina
// Resposta (clientes_listfull_response): clientes_cadastro[]
//   → codigo_cliente_omie (chave), razao_social, nome_fantasia, bairro, cidade
// O cabecalho.codigo_cliente do pedido = codigo_cliente_omie do cliente
async function fetchClientesMap() {
  const map = {}
  let page = 1, totalPages = 1

  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/clientes/', 'ListarClientes', {
        pagina:               page,
        registros_por_pagina: 50,
      })
      totalPages = data.total_de_paginas || 1
      const lista = data.clientes_cadastro || []

      for (const c of lista) {
        // Campo correto conforme doc: codigo_cliente_omie
        const codigo = String(c.codigo_cliente_omie || '')
        const nome   = (c.razao_social || c.nome_fantasia || '').trim()
        // Campos confirmados na doc: bairro, cidade (snake_case)
        const bairro = (c.bairro || '').trim()
        const cidade = (c.cidade || '').trim()

        if (codigo) {
          map[codigo] = {
            nome:   nome   || 'Anônimo',
            bairro: bairro || cidade || 'N/I',
          }
        }
      }

      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) {
      console.warn('[Omiê] ListarClientes erro:', err.message)
      break
    }
  }

  console.log(`[Omiê] ${Object.keys(map).length} clientes carregados`)
  return map
}

// ── Buscar página de pedidos (geração NOVA — snake_case) ──────────────────────
async function fetchPedidosPage(page, dateFrom, dateTo) {
  const param = {
    pagina:               page,
    registros_por_pagina: config.omie.pageSize,
    apenas_importado_api: 'N',
  }
  if (dateFrom && dateTo) {
    param.filtrar_por_data_de  = formatDateBR(dateFrom)
    param.filtrar_por_data_ate = formatDateBR(dateTo)
    param.filtrar_por_situacao = 'AUTORIZADO'
  }
  return omieCall('/produtos/pedido/', 'ListarPedidos', param)
}

function getPedidosList(data) { return data.pedido_venda_produto || [] }
function getTotalPages(data)  { return data.nTotPaginas || data.total_de_paginas || 1 }
function getTotalRecords(data){ return data.nTotRegistros || data.total_de_registros || 0 }

// ── Converter pedido → SaleRows ───────────────────────────────────────────────
function pedidoToSaleRows(pedido, vendMap, cliMap) {
  const cab  = pedido.cabecalho              || {}
  const info = pedido.informacoes_adicionais || {}
  const det  = pedido.det                    || []

  const numeroPedido = String(cab.numero_pedido || cab.codigo_pedido || '')
  if (!numeroPedido) return []

  const data = parseDateBR(cab.data_previsao || cab.dDtPedido || null)
  if (!data) return []

  // codVend está em informacoes_adicionais (confirmado no debug)
  const codVend  = String(info.codVend || '')
  const vendedor = (codVend && vendMap[codVend]) ? vendMap[codVend] : (codVend ? `Vend.${codVend}` : 'N/A')

  // codigo_cliente está em cabecalho (confirmado no debug)
  const codCli  = String(cab.codigo_cliente || '')
  const cliData = cliMap[codCli] || null
  const cliente = cliData ? cliData.nome   : (codCli ? `Cliente ${codCli}` : 'Anônimo')
  const bairro  = cliData ? cliData.bairro : 'N/I'

  // Filtro de segurança: processar apenas pedidos com situação 'Autorizado'
  // No Omiê, a situação pode vir em cabecalho.etapa ou cabecalho.cEtapa
  const situacao = (cab.etapa || cab.cEtapa || '').toUpperCase()
  if (situacao && situacao !== '20' && situacao !== 'AUTORIZADO') return []

  // Cálculo de proporção para rateio de frete e outras despesas (se houver no cabeçalho)
  const totalMercadoria = parseFloat(cab.valor_total_pedido || 0)
  const freteTotal      = parseFloat(cab.valor_frete || 0)
  const despesasTotal   = parseFloat(cab.valor_outras_despesas || 0)
  const descontoTotal   = parseFloat(cab.valor_desconto || 0)

  const rows = []
  det.forEach((item, idx) => {
    const prod = item.produto || {}

    const produto    = (prod.descricao    || prod.cDescricao || 'Produto').trim() || 'Produto'
    const marca      = (prod.familia      || prod.cNomeFamilia || 'S/Marca').trim() || 'S/Marca'
    const quantidade = Math.max(1, Math.round(parseFloat(prod.quantidade || prod.nQtdPedido || 1) || 1))

    // Valor líquido do item (já considera desconto do item se houver)
    let valorItem = parseFloat(
      prod.valor_total     ||
      prod.valor_mercadoria ||
      (prod.valor_unitario && prod.quantidade
        ? parseFloat(prod.valor_unitario) * parseFloat(prod.quantidade)
        : 0
      ) || 0
    )

    // Rateio de valores do cabeçalho (Frete, Despesas, ICMS ST, IPI)
    // Se o valor_total do item não incluir esses campos, somamos proporcionalmente
    const icmsST = parseFloat(prod.valor_icms_st || 0)
    const ipi    = parseFloat(prod.valor_ipi || 0)
    
    let valorFinal = valorItem + icmsST + ipi

    // Rateio proporcional de frete e despesas do cabeçalho
    if (totalMercadoria > 0) {
      const proporcao = valorItem / totalMercadoria
      valorFinal += (freteTotal * proporcao)
      valorFinal += (despesasTotal * proporcao)
      // O desconto do cabeçalho geralmente já está refletido no valor_total do item no Omiê, 
      // mas se não estiver, aplicaríamos aqui: valorFinal -= (descontoTotal * proporcao)
    }

    if (valorFinal <= 0) return

    rows.push({
      omie_id:    `${numeroPedido}-${idx}`,
      data:       data.toISOString().slice(0, 10),
      valor:      Math.round(valorFinal * 100) / 100,
      cliente,
      produto,
      marca,
      vendedor,
      bairro,
      quantidade,
      source:     'omie',
    })
  })

  return rows
}

// ── Buscar todos os pedidos de um período ─────────────────────────────────────
async function fetchAllPedidos(dateFrom, dateTo) {
  console.log(`[Omiê] Iniciando sync: ${formatDateBR(dateFrom)} → ${formatDateBR(dateTo)}`)

  const from = new Date(dateFrom); from.setHours(0,0,0,0)
  const to   = new Date(dateTo);   to.setHours(23,59,59,999)

  // Carrega cadastros em paralelo antes de processar pedidos
  console.log('[Omiê] Carregando cadastros de vendedores e clientes...')
  const [vendMap, cliMap] = await Promise.all([
    fetchVendedoresMap(),
    fetchClientesMap(),
  ])

  console.log('[Omiê] Processando pedidos...')
  const rows = []
  let page = 1, totalPages = 1

  while (page <= totalPages) {
    const data = await fetchPedidosPage(page, from, to)
    totalPages = getTotalPages(data)
    const pedidos = getPedidosList(data)

    if (page === 1) {
      console.log(`[Omiê] ${getTotalRecords(data)} pedidos (${totalPages} pág.)`)
    }

    for (const p of pedidos) {
      for (const row of pedidoToSaleRows(p, vendMap, cliMap)) {
        const d = new Date(row.data)
        if (d >= from && d <= to) rows.push(row)
      }
    }

    if (!pedidos.length || page >= totalPages) break
    page++
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`[Omiê] Sync concluído: ${rows.length} itens`)
  return rows
}

// ── Testar conexão ────────────────────────────────────────────────────────────
async function testConnection(dateFrom, dateTo) {
  const [vendMap, cliMap] = await Promise.all([
    fetchVendedoresMap(),
    fetchClientesMap(),
  ])

  const data    = await fetchPedidosPage(1, dateFrom, dateTo)
  const pedidos = getPedidosList(data)
  const sample  = pedidos[0] || null
  const converted = sample ? pedidoToSaleRows(sample, vendMap, cliMap) : []

  return {
    ok:             true,
    total_pedidos:  getTotalRecords(data),
    total_paginas:  getTotalPages(data),
    vendedores_map: Object.keys(vendMap).length,
    clientes_map:   Object.keys(cliMap).length,
    sample_raw:     sample,
    sample_fields:  sample ? {
      cabecalho:              Object.keys(sample.cabecalho              || {}),
      informacoes_adicionais: Object.keys(sample.informacoes_adicionais || {}),
      det_produto:            Object.keys((sample.det?.[0]?.produto)    || {}),
    } : null,
    sample_converted: converted,
  }
}

module.exports = { fetchAllPedidos, testConnection, formatDateBR, parseDateBR }
