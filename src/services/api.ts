// ============================================================
// MÓDULO 2 — Camada de API
// Abstração que permite migrar de upload local para API REST
// sem alterar os componentes. Hoje retorna dados do IndexedDB;
// amanhã, chama o backend.
// ============================================================

import type { SaleRow, FilterState, Paginated, TableColumn } from '@/types'
import { applyFilters }   from './filters'
import { loadRows }       from './db'

// ── Feature flag: toggle to use real API ─────────────────────────────────────
const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

// ── Generic fetch helper ──────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

// ── Sales service ─────────────────────────────────────────────────────────────

/**
 * Loads all sale rows.
 * Local: reads from IndexedDB.
 * API mode: GET /api/sales
 */
export async function fetchSalesData(): Promise<SaleRow[]> {
  if (USE_API) {
    return apiFetch<SaleRow[]>('/sales')
  }
  return loadRows()
}

/**
 * Fetches a paginated, filtered, sorted page of rows.
 * Local: applies filters in memory.
 * API mode: POST /api/sales/query
 */
export async function querySales(params: {
  filters:  FilterState
  page:     number
  pageSize: number
  sortBy?:  string
  sortDir?: 'asc' | 'desc'
}): Promise<Paginated<SaleRow>> {
  if (USE_API) {
    return apiFetch<Paginated<SaleRow>>('/sales/query', {
      method: 'POST',
      body:   JSON.stringify(params),
    })
  }

  // Local mode
  const all      = await loadRows()
  const filtered = applyFilters(all, params.filters)
  const sorted   = [...filtered].sort((a, b) => {
    if (!params.sortBy) return 0
    const av = a[params.sortBy as keyof SaleRow]
    const bv = b[params.sortBy as keyof SaleRow]
    const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', { numeric: true })
    return params.sortDir === 'desc' ? -cmp : cmp
  })

  const total      = sorted.length
  const totalPages = Math.ceil(total / params.pageSize)
  const start      = (params.page - 1) * params.pageSize
  const items      = sorted.slice(start, start + params.pageSize)

  return { items, total, page: params.page, pageSize: params.pageSize, totalPages }
}

/**
 * Upload a file to the backend for processing (API mode only).
 * Returns server-processed rows; local mode is handled directly by the parser.
 */
export async function uploadFile(file: File): Promise<SaleRow[]> {
  if (!USE_API) throw new Error('uploadFile: use parser.ts for local mode')

  const formData = new FormData()
  formData.append('file', file)

  return apiFetch<SaleRow[]>('/sales/upload', {
    method: 'POST',
    body:   formData,
    headers: {},  // Let browser set multipart boundary
  })
}

// ── Table column definitions ──────────────────────────────────────────────────
export const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { key: '_date',     header: 'Data',      sortable: true,  format: 'date',     width: '110px' },
  { key: '_cliente',  header: 'Cliente',   sortable: true,  format: 'text',     width: '200px' },
  { key: '_produto',  header: 'Produto',   sortable: true,  format: 'text'                     },
  { key: '_marca',    header: 'Marca',     sortable: true,  format: 'text',     width: '120px' },
  { key: '_vendedor', header: 'Vendedor',  sortable: true,  format: 'text',     width: '130px' },
  { key: '_bairro',   header: 'Localidade',sortable: true,  format: 'text',     width: '130px' },
  { key: '_qtd',      header: 'Qtd',       sortable: true,  format: 'integer',  width: '70px',  align: 'right' },
  { key: '_val',      header: 'Valor',     sortable: true,  format: 'currency', width: '120px', align: 'right' },
]
