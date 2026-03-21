// ============================================================
// Exportação da tabela de markup — PDF + Excel
// ============================================================

import * as XLSX        from 'xlsx'
import jsPDF            from 'jspdf'
import autoTable        from 'jspdf-autotable'
import { formatCurrency } from '@/services/analytics'
import { format }       from 'date-fns'
import { ptBR }         from 'date-fns/locale'

interface PricingItem {
  produto:       string
  custo:         number
  precoVenda:    number
  precoSugerido: number
  markup:        number
  margem:        number
  margemStatus:  string
}
interface GlobalConfig {
  icms: number; pisCofins: number; comissao: number
  frete: number; despesasFixas: number; lucroDesejado: number; regime: string
}

export function exportMarkupReport(items: PricingItem[], config: GlobalConfig): void {
  const now      = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const fileName = `LARBRAS_Markup_${format(new Date(), 'yyyy-MM-dd')}`
  const totalDesp = config.icms + config.pisCofins + config.comissao + config.frete + config.despesasFixas

  // ── Excel ──────────────────────────────────────────────────────────────────
  const wb  = XLSX.utils.book_new()

  // Sheet 1: Pricing table
  const data = items.map((i) => ({
    'Produto':           i.produto,
    'Custo (R$)':        i.custo || '',
    'Total Despesas (R$)': i.custo > 0 ? parseFloat((i.precoSugerido * totalDesp / 100).toFixed(2)) : '',
    'Preço Sugerido':    i.custo > 0 ? parseFloat(i.precoSugerido.toFixed(2)) : '',
    'Preço Praticado':   parseFloat(i.precoVenda.toFixed(2)),
    'Markup %':          i.custo > 0 ? parseFloat(i.markup.toFixed(2)) : '',
    'Margem %':          i.custo > 0 ? parseFloat(i.margem.toFixed(2)) : '',
    'Status':            i.custo > 0 ? i.margemStatus : 'sem custo',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Tabela de Preços')

  // Sheet 2: Config
  const cfgData = [
    { 'Parâmetro': 'ICMS',             'Valor': config.icms + '%' },
    { 'Parâmetro': 'PIS/COFINS',       'Valor': config.pisCofins + '%' },
    { 'Parâmetro': 'Comissão',         'Valor': config.comissao + '%' },
    { 'Parâmetro': 'Frete/Logística',  'Valor': config.frete + '%' },
    { 'Parâmetro': 'Despesas Fixas',   'Valor': config.despesasFixas + '%' },
    { 'Parâmetro': 'Total Despesas',   'Valor': totalDesp + '%' },
    { 'Parâmetro': 'Lucro Desejado',   'Valor': config.lucroDesejado + '%' },
    { 'Parâmetro': 'Regime Tributário','Valor': config.regime },
    { 'Parâmetro': 'Markup Divisor',   'Valor': (100 / (100 - totalDesp - config.lucroDesejado)).toFixed(4) },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cfgData), 'Configuração')

  XLSX.writeFile(wb, `${fileName}.xlsx`)

  // ── PDF ────────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(13, 15, 26)
  doc.rect(0, 0, PW, 22, 'F')
  doc.setTextColor(245, 166, 35)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('LARBRAS — Tabela de Markup e Precificação', 14, 13)
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${now} · Regime: ${config.regime} · Meta margem: ${config.lucroDesejado}%`, PW - 14, 13, { align:'right' })

  // Config summary bar
  doc.setFillColor(22, 25, 41)
  doc.rect(0, 22, PW, 12, 'F')
  const cfgStr = `ICMS ${config.icms}%  |  PIS/COFINS ${config.pisCofins}%  |  Comissão ${config.comissao}%  |  Frete ${config.frete}%  |  Desp.Fixas ${config.despesasFixas}%  |  Total Desp. ${totalDesp}%  |  Lucro ${config.lucroDesejado}%`
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7.5)
  doc.text(cfgStr, PW / 2, 29, { align:'center' })

  // Pricing table
  autoTable(doc, {
    startY: 37,
    head:   [['Produto','Custo','Total Desp.','Preço Sugerido','Preço Praticado','Markup %','Margem %','Status']],
    body:   items.map((i) => [
      i.produto.slice(0,38),
      i.custo > 0 ? formatCurrency(i.custo) : '—',
      i.custo > 0 ? formatCurrency(i.precoSugerido * totalDesp / 100) : '—',
      i.custo > 0 ? formatCurrency(i.precoSugerido) : '—',
      formatCurrency(i.precoVenda),
      i.custo > 0 ? i.markup.toFixed(2)+'%' : '—',
      i.custo > 0 ? i.margem.toFixed(2)+'%' : '—',
      i.custo > 0 ? i.margemStatus : 'sem custo',
    ]),
    styles:     { fontSize:7.5, cellPadding:2.5, textColor:[226,232,240], fillColor:[22,25,41], lineColor:[34,40,64], lineWidth:0.1 },
    headStyles: { fillColor:[22,25,41], textColor:[100,116,139], fontStyle:'bold', fontSize:7 },
    alternateRowStyles: { fillColor:[28,32,53] },
    columnStyles: {
      3: { halign:'right', fontStyle:'bold', textColor:[245,166,35] },
      4: { halign:'right' },
      5: { halign:'right', textColor:[91,141,238] },
      6: { halign:'right', textColor:[34,211,160] },
      7: { halign:'center', fontSize:7 },
    },
  })

  doc.save(`${fileName}.pdf`)
}
