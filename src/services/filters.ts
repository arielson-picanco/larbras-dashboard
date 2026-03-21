// ============================================================
// MÓDULO 2 — Serviço de Filtros
// Aplica os filtros do estado sobre o conjunto de linhas.
// ============================================================

import type { SaleRow, FilterState } from '@/types'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export function applyFilters(rows: SaleRow[], filters: FilterState): SaleRow[] {
  let result = rows

  // Period shortcut (30d, 90d etc.) — takes priority over dateRange
  if (filters.period > 0) {
    const cutoff = subDays(new Date(), filters.period)
    result = result.filter((r) => !r._date || r._date >= cutoff)
  } else if (filters.dateRange.from || filters.dateRange.to) {
    const from = filters.dateRange.from ? startOfDay(filters.dateRange.from) : null
    const to   = filters.dateRange.to   ? endOfDay(filters.dateRange.to)     : null
    result = result.filter((r) => {
      if (!r._date) return true
      if (from && r._date < from) return false
      if (to   && r._date > to)   return false
      return true
    })
  }

  if (filters.vendedor) {
    result = result.filter((r) => r._vendedor === filters.vendedor)
  }

  if (filters.produto) {
    result = result.filter((r) => r._produto === filters.produto)
  }

  if (filters.marca) {
    result = result.filter((r) => r._marca === filters.marca)
  }

  if (filters.bairro) {
    result = result.filter((r) => r._bairro === filters.bairro)
  }

  if (filters.search.trim()) {
    const term = filters.search.trim().toLowerCase()
    result = result.filter(
      (r) =>
        r._cliente.toLowerCase().includes(term) ||
        r._produto.toLowerCase().includes(term) ||
        r._vendedor.toLowerCase().includes(term) ||
        r._marca.toLowerCase().includes(term)
    )
  }

  return result
}

/** Counts how many non-default filters are active */
export function countActiveFilters(filters: FilterState): number {
  let count = 0
  if (filters.period > 0 || filters.dateRange.from || filters.dateRange.to) count++
  if (filters.vendedor) count++
  if (filters.produto)  count++
  if (filters.marca)    count++
  if (filters.bairro)   count++
  if (filters.search)   count++
  return count
}
