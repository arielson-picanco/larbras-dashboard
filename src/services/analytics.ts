// ============================================================
// MÓDULO 2 — Serviço de Analytics  (v7 — bairros corrigidos)
// ============================================================

import type { SaleRow, DerivedData, KPIMetric } from '@/types'
import { format } from 'date-fns'
import { ptBR }   from 'date-fns/locale'

// ── Mapa de aliases manuais para bairros ─────────────────────────────────────
// Chave: forma normalizada (sem acento, minúsculo, sem hífens)
// Valor: nome canônico exibido no dashboard
const BAIRRO_ALIASES: Record<string, string> = {
  // Tarumã-Açu → Tarumã
  'taruma acu':             'Tarumã',
  'taruma-acu':             'Tarumã',
  'taruma':                 'Tarumã',
  // Iranduba — sem sufixo de estado
  'iranduba':               'Iranduba',
  'iranduba am':            'Iranduba',
  'iranduba-am':            'Iranduba',
  // Cacau Pirera (nome oficial do bairro — 3 grafias comuns)
  'cacau pirera':           'Cacau Pirera',
  'cacau pireira':          'Cacau Pirera',
  'cacau pereira':          'Cacau Pirera',
  // Santo Antônio
  'sto antonio':            'Santo Antônio',
  'sto antônio':            'Santo Antônio',
  'santo antonio':          'Santo Antônio',
  // São Raimundo
  's raimundo':             'São Raimundo',
  'sao raimundo':           'São Raimundo',
  'são raimundo':           'São Raimundo',
  // Vila da Prata
  'vl da prata':            'Vila da Prata',
  'vila da prata':          'Vila da Prata',
  // Compensa (3 grafias)
  'compensa 1':             'Compensa',
  'compensa 2':             'Compensa',
  'compensa2':              'Compensa',
  'compensa':               'Compensa',
  // Parque 10 de Novembro
  'prq 10 de novembro':     'Parque 10 de Novembro',
  'parque 10 de novembro':  'Parque 10 de Novembro',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeKey(str: string): string {
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(str: string): string {
  const minor = new Set(['de', 'da', 'do', 'das', 'dos', 'di', 'e', 'a', 'o', 'em', 'no', 'na', 'nos', 'nas'])
  return str
    .split(' ')
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

function groupBy<T extends object>(
  rows: T[],
  key: keyof T,
  valueKey: keyof T
): { name: string; total: number; orders: number }[] {
  const map = new Map<string, { total: number; orders: number }>()
  for (const row of rows) {
    const name  = String(row[key] ?? 'N/I')
    const value = Number(row[valueKey] ?? 0)
    const prev  = map.get(name) ?? { total: 0, orders: 0 }
    map.set(name, { total: prev.total + value, orders: prev.orders + 1 })
  }
  return [...map.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
}

// GroupBy com normalização + aliases manuais de bairros.
function groupByNormalized(
  rows: SaleRow[],
  key: keyof SaleRow,
  valueKey: keyof SaleRow
): { name: string; total: number; orders: number }[] {
  const map = new Map<string, { total: number; orders: number }>()

  for (const row of rows) {
    const raw  = String(row[key] ?? 'N/I').trim() || 'N/I'
    const nKey = normalizeKey(raw)
    const canonical = BAIRRO_ALIASES[nKey] ?? titleCase(nKey)

    const prev = map.get(canonical) ?? { total: 0, orders: 0 }
    map.set(canonical, {
      total:  prev.total  + Number(row[valueKey] ?? 0),
      orders: prev.orders + 1,
    })
  }

  return [...map.entries()]
    .map(([name, data]) => ({ name, total: data.total, orders: data.orders }))
    .sort((a, b) => b.total - a.total)
}

function groupByDate(rows: SaleRow[]): { date: string; total: number; orders: number }[] {
  const map = new Map<string, { total: number; orders: number }>()
  for (const row of rows) {
    if (!row._date) continue
    const key  = format(row._date, 'yyyy-MM-dd')
    const prev = map.get(key) ?? { total: 0, orders: 0 }
    map.set(key, { total: prev.total + row._val, orders: prev.orders + 1 })
  }
  return [...map.entries()]
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildPreviousPeriod(rows: SaleRow[], from: Date, to: Date): SaleRow[] {
  const duration = to.getTime() - from.getTime()
  const prevTo   = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - duration)
  return rows.filter((r) => r._date && r._date >= prevFrom && r._date <= prevTo)
}

// ── Main buildDerived ─────────────────────────────────────────────────────────
export function buildDerived(rows: SaleRow[]): DerivedData {
  if (!rows.length) {
    return {
      totalRevenue:      0, prevRevenue:      0,
      totalOrders:       0, prevOrders:       0,
      avgTicket:         0, prevTicket:       0,
      avgTicketPerClient:0,
      totalQty:          0,
      uniqueClients:     0,
      byVendedor: [], byProduto: [], byMarca: [], byBairro: [],
      byDate:     [], topClientes: [],
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + r._val, 0)
  const totalOrders  = rows.length
  const totalQty     = rows.reduce((s, r) => s + r._qtd, 0)
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const clienteSet         = new Set(rows.map((r) => r._cliente))
  const uniqueClients      = clienteSet.size
  const avgTicketPerClient = uniqueClients > 0 ? totalRevenue / uniqueClients : 0

  const datedRows = rows.filter((r) => r._date)
  let prevRevenue = 0, prevOrders = 0, prevTicket = 0
  if (datedRows.length) {
    const allDates = datedRows.map((r) => r._date!.getTime())
    const from     = new Date(Math.min(...allDates))
    const to       = new Date(Math.max(...allDates))
    const prevRows = buildPreviousPeriod(rows, from, to)
    prevRevenue    = prevRows.reduce((s, r) => s + r._val, 0)
    prevOrders     = prevRows.length
    prevTicket     = prevOrders > 0 ? prevRevenue / prevOrders : 0
  }

  return {
    totalRevenue, prevRevenue,
    totalOrders,  prevOrders,
    avgTicket,    prevTicket,
    avgTicketPerClient,
    totalQty,
    uniqueClients,
    byVendedor:  groupBy(rows, '_vendedor', '_val'),
    byProduto:   groupBy(rows, '_produto',  '_val'),
    byMarca:     groupBy(rows, '_marca',    '_val').slice(0, 30),
    byBairro:    groupByNormalized(rows, '_bairro', '_val'),
    byDate:      groupByDate(rows),
    topClientes: groupBy(rows, '_cliente',  '_val').slice(0, 10),
  }
}

// ── KPI builder ───────────────────────────────────────────────────────────────
export function buildKPIMetrics(derived: DerivedData): KPIMetric[] {
  return [
    { id:'revenue', label:'Faturamento Total',   value:derived.totalRevenue, previousValue:derived.prevRevenue, format:'currency', icon:'TrendingUp',   color:'amber' },
    { id:'orders',  label:'Pedidos',              value:derived.totalOrders,  previousValue:derived.prevOrders,  format:'integer',  icon:'ShoppingCart', color:'blue'  },
    { id:'ticket',  label:'Ticket Médio / Pedido',value:derived.avgTicket,   previousValue:derived.prevTicket,  format:'currency', icon:'Receipt',      color:'green' },
    { id:'qty',     label:'Unidades Vendidas',    value:derived.totalQty,     previousValue:0,                   format:'integer',  icon:'Package',      color:'purple'},
  ]
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 }).format(value)
}
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style:'percent', minimumFractionDigits:1, maximumFractionDigits:1 }).format(value / 100)
}
export function calcChange(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}
export function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}
export function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return format(d, 'dd/MM', { locale: ptBR })
}
