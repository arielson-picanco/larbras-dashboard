// ============================================================
// MÓDULO 6 — Serviço de Exportação
// Exporta o estado atual do dashboard para PDF ou XLSX.
// ============================================================

import * as XLSX                     from 'xlsx'
import jsPDF                         from 'jspdf'
import autoTable                     from 'jspdf-autotable'
import type { SaleRow, DerivedData } from '@/types'
import { formatCurrency, formatDate } from './analytics'
import { format }                     from 'date-fns'
import { ptBR }                       from 'date-fns/locale'

// ── Excel Export ──────────────────────────────────────────────────────────────
export function exportToExcel(rows: SaleRow[], derived: DerivedData): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: raw data
  const dataSheet = rows.map((r) => ({
    'Data':        r._date ? format(r._date, 'dd/MM/yyyy') : '',
    'Cliente':     r._cliente,
    'Produto':     r._produto,
    'Marca':       r._marca,
    'Vendedor':    r._vendedor,
    'Localidade':  r._bairro,
    'Quantidade':  r._qtd,
    'Valor (R$)':  r._val,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataSheet), 'Dados')

  // Sheet 2: KPI summary
  const kpiSheet = [
    { 'Métrica': 'Faturamento Total',  'Valor': formatCurrency(derived.totalRevenue) },
    { 'Métrica': 'Total de Pedidos',   'Valor': derived.totalOrders },
    { 'Métrica': 'Ticket Médio',       'Valor': formatCurrency(derived.avgTicket) },
    { 'Métrica': 'Unidades Vendidas',  'Valor': derived.totalQty },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiSheet), 'KPIs')

  // Sheet 3: by product
  const prodSheet = derived.byProduto.map((p) => ({
    'Produto':  p.name,
    'Receita':  formatCurrency(p.total),
    'Pedidos':  p.orders,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodSheet), 'Por Produto')

  // Sheet 4: by seller
  const sellerSheet = derived.byVendedor.map((v) => ({
    'Vendedor': v.name,
    'Receita':  formatCurrency(v.total),
    'Pedidos':  v.orders,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sellerSheet), 'Por Vendedor')

  // Sheet 5: top clients
  const clientSheet = derived.topClientes.map((c) => ({
    'Cliente':  c.name,
    'Receita':  formatCurrency(c.total),
    'Pedidos':  c.orders,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientSheet), 'Top Clientes')

  const fileName = `LARBRAS_Vendas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// ── PDF Export ────────────────────────────────────────────────────────────────
export function exportToPDF(rows: SaleRow[], derived: DerivedData): void {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const now  = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const PAGE_W = doc.internal.pageSize.getWidth()

  // ── Header ────────────────────────────────────────
  doc.setFillColor(13, 15, 26)
  doc.rect(0, 0, PAGE_W, 20, 'F')
  doc.setTextColor(245, 166, 35)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('LARBRAS — Painel de Vendas', 14, 13)
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em ${now}`, PAGE_W - 14, 13, { align: 'right' })

  // ── KPIs ──────────────────────────────────────────
  const kpis = [
    { label: 'Faturamento',    value: formatCurrency(derived.totalRevenue) },
    { label: 'Pedidos',        value: String(derived.totalOrders) },
    { label: 'Ticket Médio',   value: formatCurrency(derived.avgTicket) },
    { label: 'Unidades',       value: String(derived.totalQty) },
  ]
  const colW = (PAGE_W - 28) / kpis.length
  kpis.forEach((kpi, i) => {
    const x = 14 + i * colW
    doc.setFillColor(22, 25, 41)
    doc.roundedRect(x, 26, colW - 4, 20, 2, 2, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(7)
    doc.text(kpi.label.toUpperCase(), x + (colW - 4) / 2, 32, { align: 'center' })
    doc.setTextColor(226, 232, 240)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(kpi.value, x + (colW - 4) / 2, 41, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })

  // ── Data table ────────────────────────────────────
  autoTable(doc, {
    startY: 52,
    head: [['Data', 'Cliente', 'Produto', 'Marca', 'Vendedor', 'Localidade', 'Qtd', 'Valor (R$)']],
    body: rows.slice(0, 500).map((r) => [
      r._date ? format(r._date, 'dd/MM/yyyy') : '',
      r._cliente,
      r._produto,
      r._marca,
      r._vendedor,
      r._bairro,
      r._qtd,
      formatCurrency(r._val),
    ]),
    styles: {
      fontSize:  8,
      cellPadding: 2,
      textColor: [226, 232, 240],
      fillColor: [22, 25, 41],
      lineColor: [34, 40, 64],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor:  [22, 25, 41],
      textColor:  [100, 116, 139],
      fontStyle:  'bold',
      fontSize:   7,
    },
    alternateRowStyles: {
      fillColor: [28, 32, 53],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [245, 166, 35] },
    },
  })

  if (rows.length > 500) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(`* Exibindo 500 de ${rows.length} registros. Exporte para Excel para dados completos.`, 14, finalY)
  }

  doc.save(`LARBRAS_Vendas_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
