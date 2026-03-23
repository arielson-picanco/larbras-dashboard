// ============================================================
// services/omie.js — v14
//
// CORREÇÃO DEFINITIVA — dois fixes simultâneos:
//
// FIX 1 — DATA: usa enc_data (Data de Encerramento do pedido)
//   O "Testar Conexão" confirmou que o campo enc_data existe no
//   cabecalho. Esse é o campo que o Omiê usa para o relatório
//   "Faturamento por Período" (Data de Emissão da NF-e).
//   O enc_data é preenchido quando o pedido muda para etapa
//   60/70 (faturamento). Antes usávamos data_previsao, que é
//   a data PREVISTA de entrega — campo completamente diferente.
//
//   Prioridade: enc_data → data_previsao → dDtPedido
//
// FIX 2 — VALOR: usa valor_total por item (desconto já incluso)
//   O "Testar Conexão" confirmou que det_produto tem os campos:
//     valor_total      = valor líquido do item (após desconto)
//     valor_desconto   = desconto individual do item
//     valor_mercadoria = valor bruto do item (antes do desconto)
//   A v12/v13 aplicava desconto proporcional do cabeçalho, o que
//   era uma aproximação. O correto é usar valor_total diretamente,
//   que já é o valor líquido calculado pelo Omiê para cada item.
// ============================================================
const fetch  = require('node-fetch')
const config = require('../config')

const OMIE_BASE = config.omie.baseUrl

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

function getEtapasFaturado() {
  const etapas = config.omie.etapasFaturado
  return Array.isArray(etapas) ? etapas : (typeof etapas === 'string' ? etapas.split(',').map(e => e.trim()).filter(Boolean) : ['60', '70'])
}

// ── Vendedores ────────────────────────────────────────────────────────────────
async function fetchVendedoresMap() {
  const map = {}
  let page = 1, totalPages = 1
  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/vendedores/', 'ListarVendedores', {
        pagina: page, registros_por_pagina: 50,
      })
      totalPages = data.total_de_paginas || 1
      const lista = data.cadastro || []
      for (const v of lista) {
        const codigo = String(v.codigo || '')
        const nome   = (v.nome || '').trim()
        if (codigo && nome) map[codigo] = nome
      }
      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) { console.warn('[Omiê] Vendedores:', err.message); break }
  }
  console.log(`[Omiê] ${Object.keys(map).length} vendedores carregados`)
  return map
}

// ── Clientes ──────────────────────────────────────────────────────────────────
async function fetchClientesMap() {
  const map = {}
  let page = 1, totalPages = 1
  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/clientes/', 'ListarClientes', {
        pagina: page, registros_por_pagina: 50,
      })
      totalPages = data.total_de_paginas || 1
      const lista = data.clientes_cadastro || []
      for (const c of lista) {
        const codigo = String(c.codigo_cliente_omie || '')
        const nome   = (c.razao_social || c.nome_fantasia || '').trim()
        const bairro = (c.bairro || '').trim()
        const cidade = (c.cidade || '').trim()
        if (codigo) map[codigo] = { nome: nome || 'Anônimo', bairro: bairro || cidade || 'N/I' }
      }
      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) { console.warn('[Omiê] Clientes:', err.message); break }
  }
  console.log(`[Omiê] ${Object.keys(map).length} clientes carregados`)
  return map
}

// ── Produtos ──────────────────────────────────────────────────────────────────
async function fetchProdutosMap() {
  const map = {}
  let page = 1, totalPages = 1
  let logadoCampos = false

  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/produtos/', 'ListarProdutos', {
        pagina:                 page,
        registros_por_pagina:   50,
        apenas_importado_api:   'N',
        filtrar_apenas_omiepdv: 'N',
      })
      totalPages = data.total_de_paginas || data.nTotPaginas || 1
      const lista = data.produto_servico_cadastro || []

      if (page === 1 && lista.length > 0 && !logadoCampos) {
        console.log('[Omiê] Campos do produto (diagnóstico):', Object.keys(lista[0]).join(', '))
        logadoCampos = true
      }

      for (const p of lista) {
        const codigo = String(p.codigo || p.codigo_produto || '').trim()
        if (!codigo) continue
        const marca = (
          (p.marca             && String(p.marca).trim())             ||
          (p.descricao_familia && String(p.descricao_familia).trim()) ||
          (p.familia           && String(p.familia).trim())           ||
          ''
        ) || 'S/Marca'
        map[codigo] = marca
      }

      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) {
      console.warn('[Omiê] ListarProdutos erro:', err.message)
      break
    }
  }

  const comMarca = Object.values(map).filter(m => m !== 'S/Marca').length
  console.log(`[Omiê] ${Object.keys(map).length} produtos (${comMarca} com marca, ${Object.keys(map).length - comMarca} S/Marca)`)
  return map
}

// ── Catálogo completo ─────────────────────────────────────────────────────────
async function fetchAllProductsCatalog() {
  const products = []
  let page = 1, totalPages = 1
  console.log('[Omiê] Carregando catálogo completo de produtos...')

  while (page <= totalPages) {
    try {
      const data = await omieCall('/geral/produtos/', 'ListarProdutos', {
        pagina:                 page,
        registros_por_pagina:   50,
        apenas_importado_api:   'N',
        filtrar_apenas_omiepdv: 'N',
      })
      totalPages = data.total_de_paginas || data.nTotPaginas || 1
      const lista = data.produto_servico_cadastro || []

      for (const p of lista) {
        const codigo = String(p.codigo || '').trim()
        if (!codigo) continue
        const marca = (
          (p.marca             && String(p.marca).trim())             ||
          (p.descricao_familia && String(p.descricao_familia).trim()) ||
          (p.familia           && String(p.familia).trim())           ||
          ''
        ) || 'S/Marca'

        products.push({
          codigo,
          descricao:      (p.descricao || codigo).trim(),
          marca,
          unidade:        p.unidade || 'UN',
          valor_unitario: parseFloat(p.valor_unitario || 0),
          ativo:          p.inativo !== 'S',
        })
      }

      if (!lista.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 250))
    } catch (err) { console.warn('[Omiê] fetchAllProductsCatalog:', err.message); break }
  }

  console.log(`[Omiê] Catálogo: ${products.length} produtos`)
  return products
}

// ── Pedidos ───────────────────────────────────────────────────────────────────
async function fetchPedidosPage(page, dateFrom, dateTo, etapa) {
  const param = {
    pagina: page, registros_por_pagina: config.omie.pageSize,
    apenas_importado_api: 'N',
    etapa,
  }
  if (dateFrom && dateTo) {
    param.filtrar_por_data_de  = formatDateBR(dateFrom)
    param.filtrar_por_data_ate = formatDateBR(dateTo)
<<<<<<< HEAD
    // Removido filtrar_por_situacao pois não é aceito pela API (Erro 5001)
    // A filtragem será feita no processamento dos resultados (pedidoToSaleRows)
=======
    param.filtrar_por_situacao = 'AUTORIZADO'
>>>>>>> 7663ac02 (fix: corrigir discrepância de faturamento na integração Omie)
  }
  return omieCall('/produtos/pedido/', 'ListarPedidos', param)
}

function getPedidosList(data) { return data.pedido_venda_produto || [] }
function getTotalPages(data)  { return data.nTotPaginas || data.total_de_paginas || 1 }
function getTotalRecords(data){ return data.nTotRegistros || data.total_de_registros || 0 }

// ── Converter pedido → SaleRows ───────────────────────────────────────────────
function pedidoToSaleRows(pedido, vendMap, cliMap, prodMap = {}) {
  const cab  = pedido.cabecalho              || {}
  const info = pedido.informacoes_adicionais || {}
  const det  = pedido.det                    || []

  const numeroPedido = String(cab.numero_pedido || cab.codigo_pedido || '')
  if (!numeroPedido) return []
  if (cab.cancelado === 'S') return []

  // ── DATA — FIX 1 ────────────────────────────────────────────────────────────
  // enc_data = Data de Encerramento do pedido = data em que a NF-e foi emitida.
  // É o mesmo campo que o relatório "Faturamento por Período" usa.
  // enc_hora / enc_motivo / enc_user são os outros campos de encerramento.
  // Fallback: data_previsao → dDtPedido (para pedidos sem enc_data preenchido)
  const data = parseDateBR(
    cab.enc_data       ||   // ← FIX: data de encerramento = emissão NF-e
    cab.data_previsao  ||
    cab.dDtPedido      ||
    null
  )
  if (!data) return []

  const codVend  = String(info.codVend || '')
  const vendedor = (codVend && vendMap[codVend]) ? vendMap[codVend] : (codVend ? `Vend.${codVend}` : 'N/A')

  const codCli  = String(cab.codigo_cliente || '')
  const cliData = cliMap[codCli] || null
  const cliente = cliData ? cliData.nome   : (codCli ? `Cliente ${codCli}` : 'Anônimo')
  const bairro  = cliData ? cliData.bairro : 'N/I'

<<<<<<< HEAD
  // Filtro de segurança: processar apenas pedidos faturados, entregues ou autorizados
  // No Omiê, a etapa pode vir em cabecalho.etapa ou cabecalho.cEtapa
  const etapa = String(cab.etapa || cab.cEtapa || '')
  const etapasFaturado = getEtapasFaturado()
  
  // Se o pedido estiver cancelado, ignoramos
  if (cab.cancelado === 'S') return []

  // CORREÇÃO: Filtrar apenas Pedidos de Venda (Operação da planilha)
  // No Omiê, pedidos de remessa ou outros tipos podem ter códigos de etapa similares
  // mas não devem compor o faturamento de venda.
  // O campo 'cModo' ou 'tipo_pedido' costuma indicar isso.
  // No pvpListarRequest, o padrão é Pedido de Venda, mas vamos reforçar.
  if (cab.bloqueado === 'S') return []

  // Etapa 20 = Autorizado, 60 = Faturado, 70 = Entregue
  if (!etapasFaturado.includes(etapa) && etapa !== '20') return []
=======
  // Filtro de segurança: processar apenas pedidos com situação 'Autorizado'
  // No Omiê, a situação pode vir em cabecalho.etapa ou cabecalho.cEtapa
  const situacao = (cab.etapa || cab.cEtapa || '').toUpperCase()
  if (situacao && situacao !== '20' && situacao !== 'AUTORIZADO') return []
>>>>>>> 7663ac02 (fix: corrigir discrepância de faturamento na integração Omie)

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

<<<<<<< HEAD
    // FIX 2: Cálculo do valor total do item para bater com o relatório de faturamento
    // O relatório "Faturamento por Período" do Omiê (conforme planilha pivot.xlsx)
    // foca no "Total da Nota Fiscal" que é:
    // Total de Mercadoria - Desconto + Frete + Seguro + Outras Despesas + IPI + ICMS ST
    
    const valorMercadoria = parseFloat(prod.valor_mercadoria || 0)
    const valorDesconto   = parseFloat(prod.valor_desconto || 0)
    const valorIcmsSt     = parseFloat(prod.valor_icms_st || 0)
    const valorIpi        = parseFloat(prod.valor_ipi || 0)
    
    // Valor líquido do item (mercadoria - desconto)
    // No Omiê, prod.valor_total já costuma ser (mercadoria - desconto)
    let valorItem = parseFloat(prod.valor_total || (valorMercadoria - valorDesconto))
    
    // Soma impostos e despesas do item
    let valorFinal = valorItem + valorIcmsSt + valorIpi

    // Rateio proporcional de frete, seguro e despesas do cabeçalho
    const totalMercadoriaPedido = parseFloat(cab.valor_total_pedido || 0)
    if (totalMercadoriaPedido > 0) {
      const freteTotal    = parseFloat(cab.valor_frete || 0)
      const seguroTotal   = parseFloat(cab.valor_seguro || 0)
      const despesasTotal = parseFloat(cab.valor_outras_despesas || 0)
      
      const proporcao = valorItem / totalMercadoriaPedido
      
      valorFinal += (freteTotal * proporcao)
      valorFinal += (seguroTotal * proporcao)
      valorFinal += (despesasTotal * proporcao)
    }

    if (valorFinal <= 0) return

    // CORREÇÃO DEDUPLICAÇÃO: usar o código interno do Omiê (cab.codigo_pedido)
    // para garantir que o ID seja imutável mesmo se o número do pedido mudar.
    const omieIdUnico = cab.codigo_pedido ? `${cab.codigo_pedido}-${idx}` : `${numeroPedido}-${idx}`
=======
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
>>>>>>> 7663ac02 (fix: corrigir discrepância de faturamento na integração Omie)

    rows.push({
      omie_id:    omieIdUnico,
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

// ── Buscar todos os pedidos FATURADOS de um período ───────────────────────────
async function fetchAllPedidos(dateFrom, dateTo) {
  const etapasFaturado = getEtapasFaturado()
  // Incluímos a etapa 20 (Autorizado) na busca para garantir que pedidos recém-autorizados entrem no sync
  const etapasBusca = [...new Set([...etapasFaturado, '20'])]
  
  console.log(`[Omiê] Iniciando sync: ${formatDateBR(dateFrom)} → ${formatDateBR(dateTo)}`)
  console.log(`[Omiê] Filtrando etapas: ${etapasBusca.join(', ')} (autorizado/faturado/entregue)`)

  // Busca com margem extra de ±15 dias para capturar pedidos cujo enc_data
  // cai dentro do período mesmo que o data_previsao esteja fora.
  const from = new Date(dateFrom); from.setHours(0,0,0,0)
  const to   = new Date(dateTo);   to.setHours(23,59,59,999)
  const fromBusca = new Date(from); fromBusca.setDate(fromBusca.getDate() - 15)
  const toBusca   = new Date(to);   toBusca.setDate(toBusca.getDate() + 15)

  console.log('[Omiê] Carregando cadastros...')
  const [vendMap, cliMap, prodMap] = await Promise.all([
    fetchVendedoresMap(),
    fetchClientesMap(),
    fetchProdutosMap(),
  ])

  console.log('[Omiê] Processando pedidos faturados...')
  const rowsMap = new Map()

  for (const etapa of etapasBusca) {
    console.log(`[Omiê] Buscando etapa ${etapa}...`)
    let page = 1, totalPages = 1

    while (page <= totalPages) {
      // Busca com janela ampliada; filtramos por enc_data no código
      const data = await fetchPedidosPage(page, fromBusca, toBusca, etapa)
      totalPages = getTotalPages(data)
      const pedidos = getPedidosList(data)

      if (page === 1) console.log(`[Omiê] Etapa ${etapa}: ${getTotalRecords(data)} pedidos (${totalPages} pág.)`)

      for (const p of pedidos) {
        for (const row of pedidoToSaleRows(p, vendMap, cliMap, prodMap)) {
          const d = new Date(row.data)
          // Filtra pelo período real (enc_data dentro do range solicitado)
          if (d >= from && d <= to) rowsMap.set(row.omie_id, row)
        }
      }

      if (!pedidos.length || page >= totalPages) break
      page++
      await new Promise(r => setTimeout(r, 300))
    }
  }

  const rows = [...rowsMap.values()]
  const semMarca = rows.filter(r => r.marca === 'S/Marca').length
  console.log(`[Omiê] Sync concluído: ${rows.length} itens (${semMarca} S/Marca)`)

  // Log para confirmar se enc_data está sendo usado
  if (rows.length > 0) {
    console.log(`[Omiê] Amostra de datas usadas (primeiros 3 registros):`,
      rows.slice(0, 3).map(r => r.data).join(', '))
  }

  return rows
}

// ── Testar conexão ────────────────────────────────────────────────────────────
async function testConnection(dateFrom, dateTo) {
  const etapasFaturado = getEtapasFaturado()
  const [vendMap, cliMap, prodMap] = await Promise.all([
    fetchVendedoresMap(),
    fetchClientesMap(),
    fetchProdutosMap(),
  ])

  const dataTodos = await omieCall('/produtos/pedido/', 'ListarPedidos', {
    pagina: 1, registros_por_pagina: config.omie.pageSize,
    apenas_importado_api: 'N',
    filtrar_por_data_de:  formatDateBR(dateFrom),
    filtrar_por_data_ate: formatDateBR(dateTo),
  })
  const pedidosTodos = getPedidosList(dataTodos)

  const etapasEncontradas = {}
  pedidosTodos.forEach(p => {
    const etapa = String(p.cabecalho?.etapa || 'desconhecida')
    etapasEncontradas[etapa] = (etapasEncontradas[etapa] || 0) + 1
  })

  let sample = null
  for (const etapa of etapasFaturado) {
    sample = pedidosTodos.find(p => String(p.cabecalho?.etapa) === etapa)
    if (sample) break
  }
  if (!sample) sample = pedidosTodos[0] || null

  const cab     = sample?.cabecalho || {}
  const det0    = sample?.det?.[0]?.produto || {}
  const converted = sample ? pedidoToSaleRows(sample, vendMap, cliMap, prodMap) : []

  return {
    ok:                   true,
    total_pedidos_todos:  getTotalRecords(dataTodos),
    etapas_encontradas:   etapasEncontradas,
    etapas_configuradas:  etapasFaturado,
    aviso_configuracao:   Object.keys(etapasEncontradas).length > 0 &&
                          etapasFaturado.every(e => !etapasEncontradas[e])
                          ? `ATENÇÃO: etapas (${etapasFaturado.join(',')}) não encontradas. Disponíveis: ${Object.keys(etapasEncontradas).join(', ')}`
                          : null,
    vendedores_map:       Object.keys(vendMap).length,
    clientes_map:         Object.keys(cliMap).length,
    produtos_map:         Object.keys(prodMap).length,
    marcas_amostra:       Object.entries(prodMap).slice(0, 5).map(([k,v]) => `${k}=${v}`),
    // Diagnóstico dos dois campos corrigidos
    diagnostico_v14: {
      // FIX 1 — Data
      enc_data_valor:        cab.enc_data      || '(vazio — fallback para data_previsao)',
      data_previsao_valor:   cab.data_previsao || '(vazio)',
      data_usada_no_sync:    cab.enc_data || cab.data_previsao || '(nenhuma)',
      // FIX 2 — Valor
      det0_valor_total:      det0.valor_total      ?? '(campo não encontrado)',
      det0_valor_mercadoria: det0.valor_mercadoria ?? '(campo não encontrado)',
      det0_valor_desconto:   det0.valor_desconto   ?? '(campo não encontrado)',
    },
    sample_converted: converted,
  }
}

module.exports = {
  fetchAllPedidos,
  fetchAllProductsCatalog,
  testConnection,
  formatDateBR,
  parseDateBR,
}
