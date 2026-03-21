// ============================================================
// MÓDULO 1 — Tipos centrais do sistema  (v4)
// ============================================================

export interface RawRow {
  [key: string]: string | number | Date | null
}

export interface SaleRow {
  _val:      number
  _cliente:  string
  _bairro:   string
  _produto:  string
  _marca:    string
  _vendedor: string
  _qtd:      number
  _date:     Date | null
  _raw:      RawRow
}

export interface FilterState {
  dateRange: { from: Date | null; to: Date | null }
  vendedor:  string
  produto:   string
  marca:     string
  bairro:    string
  search:    string
  period:    number
}

export interface ColumnDef {
  key:      string
  label:    string
  active:   boolean
  mapTo:    string
  alts:     string[]
  _builtin: boolean
}

export interface DerivedData {
  totalRevenue:       number
  prevRevenue:        number
  totalOrders:        number
  prevOrders:         number

  /** Ticket médio por transação/pedido = totalRevenue / totalOrders */
  avgTicket:          number
  prevTicket:         number

  /** Ticket médio por cliente único = totalRevenue / uniqueClients */
  avgTicketPerClient: number

  totalQty:           number
  uniqueClients:      number   // Nº de clientes únicos no período

  byVendedor:  { name: string; total: number; orders: number }[]
  byProduto:   { name: string; total: number; orders: number }[]
  byMarca:     { name: string; total: number }[]
  byBairro:    { name: string; total: number }[]
  byDate:      { date: string; total: number; orders: number }[]
  topClientes: { name: string; total: number; orders: number }[]
}

export interface KPIMetric {
  id:            string
  label:         string
  value:         number
  previousValue: number
  format:        'currency' | 'integer' | 'decimal'
  icon:          string
  color:         'amber' | 'green' | 'blue' | 'purple'
}

export interface ExportOptions {
  format:   'pdf' | 'xlsx'
  scope:    'current' | 'all'
  sections: ('kpi' | 'charts' | 'table')[]
}

export interface Paginated<T> {
  items:      T[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export interface TableColumn {
  key:       keyof SaleRow | string
  header:    string
  sortable?: boolean
  align?:    'left' | 'right' | 'center'
  format?:   'currency' | 'date' | 'text' | 'integer'
  width?:    string
}

export interface SortState {
  column: string
  dir:    'asc' | 'desc'
}

export interface APIConfig {
  baseURL:  string
  headers?: Record<string, string>
}

export interface APIResponse<T> {
  data:    T
  status:  number
  message: string
}
