// ============================================================
// MÓDULO 10 — Exportação de relatório de comparação de produtos
// Gera PDF e XLSX com análise completa
// ============================================================

import * as XLSX   from 'xlsx'
import jsPDF       from 'jspdf'
import autoTable   from 'jspdf-autotable'
import { formatCurrency } from '@/services/analytics'
import { format }  from 'date-fns'
import { ptBR }    from 'date-fns/locale'
import type { DerivedData } from '@/types'

type PData = {
  name:          string
  color:         string
  total:         number
  orders:        number
  qty:           number
  ticket:        number
  uniqueClients: number
  brand:         string
  topBairros:    string[]
  coPurchases:   { name: string; count: number }[]
}

export function exportProductReport(
  productData: PData[],
  derived:     DerivedData | null,
): void {
  const now      = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const fileName = `LARBRAS_Comparacao_Produtos_${format(new Date(), 'yyyy-MM-dd')}`

  // ── Generate Excel ─────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = productData.map((p) => ({
    'Produto':          p.name,
    'Marca':            p.brand,
    'Faturamento':      formatCurrency(p.total),
    'Faturamento (R$)': p.total,
    'Pedidos':          p.orders,
    'Ticket Médio':     formatCurrency(p.ticket),
    'Unidades':         p.qty,
    'Clientes Únicos':  p.uniqueClients,
    '% do Total':       derived?.totalRevenue
      ? ((p.total / derived.totalRevenue) * 100).toFixed(2) + '%'
      : '0.00%',
    'Top Bairros':      p.topBairros.join(' | '),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Comparação')

  // Sheet 2: Co-purchases
  const coData = productData.flatMap((p) =>
    p.coPurchases.map((cp) => ({
      'Produto Base':          p.name,
      'Produto Co-comprado':   cp.name,
      'Frequência':            cp.count,
    }))
  )
  if (coData.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coData), 'Co-compras')
  }

  // Sheet 3: Rankings
  const rankData = [...productData]
    .sort((a, b) => b.total - a.total)
    .map((p, i) => ({
      'Posição':         i + 1,
      'Produto':         p.name,
      'Faturamento':     p.total,
      'Pedidos':         p.orders,
      'Ticket':          p.ticket,
      'Clientes Únicos': p.uniqueClients,
    }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankData), 'Rankings')

  XLSX.writeFile(wb, `${fileName}.xlsx`)

  // ── Generate PDF ───────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(13, 15, 26)
  doc.rect(0, 0, PW, 22, 'F')
  doc.setTextColor(245, 166, 35)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('LARBRAS — Comparação de Produtos', 14, 14)
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em ${now}`, PW - 14, 14, { align: 'right' })

  // Product chips
  const chipW = (PW - 28) / productData.length
  productData.forEach((p, i) => {
    const x  = 14 + i * chipW
    const hex = p.color
    const r   = parseInt(hex.slice(1,3),16)
    const g   = parseInt(hex.slice(3,5),16)
    const b   = parseInt(hex.slice(5,7),16)
    doc.setFillColor(r, g, b)
    doc.roundedRect(x, 27, chipW - 3, 5, 1, 1, 'F')
  })

  // KPI table
  autoTable(doc, {
    startY:   36,
    head:     [['Produto', 'Marca', 'Faturamento', 'Pedidos', 'Ticket Médio', 'Unidades', 'Clientes Únicos', '% Total']],
    body:     productData.map((p) => [
      p.name.slice(0, 35),
      p.brand,
      formatCurrency(p.total),
      p.orders,
      formatCurrency(p.ticket),
      p.qty,
      p.uniqueClients,
      derived?.totalRevenue ? ((p.total / derived.totalRevenue) * 100).toFixed(1) + '%' : '-',
    ]),
    styles:       { fontSize:8, cellPadding:3, textColor:[226,232,240], fillColor:[22,25,41], lineColor:[34,40,64], lineWidth:0.1 },
    headStyles:   { fillColor:[22,25,41], textColor:[100,116,139], fontStyle:'bold', fontSize:7 },
    alternateRowStyles: { fillColor:[28,32,53] },
    columnStyles: {
      2: { halign:'right', fontStyle:'bold', textColor:[245,166,35] },
      4: { halign:'right' },
      7: { halign:'right' },
    },
  })

  // Co-purchase table (if data)
  if (coData.length) {
    const lastY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('CO-COMPRAS (PRODUTOS FREQUENTEMENTE VENDIDOS JUNTOS)', 14, lastY)
    autoTable(doc, {
      startY: lastY + 4,
      head:   [['Produto Base', 'Produto Co-comprado', 'Frequência']],
      body:   coData.slice(0, 20).map((c) => [c['Produto Base'].slice(0,40), c['Produto Co-comprado'].slice(0,40), c['Frequência']]),
      styles: { fontSize:8, cellPadding:2, textColor:[226,232,240], fillColor:[22,25,41], lineColor:[34,40,64], lineWidth:0.1 },
      headStyles: { fillColor:[22,25,41], textColor:[100,116,139], fontStyle:'bold', fontSize:7 },
      alternateRowStyles: { fillColor:[28,32,53] },
      columnStyles: { 2: { halign:'center' } },
    })
  }

  doc.save(`${fileName}.pdf`)
}
