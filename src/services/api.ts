// ============================================================
// MÓDULO 2 — Camada de API  (v2 — com autenticação JWT)
// Modo local  (VITE_USE_API=false): IndexedDB
// Modo backend (VITE_USE_API=true):  GET /api/sales com JWT
// ============================================================

import type { SaleRow, FilterState, Paginated, TableColumn } from '@/types'
import { applyFilters } from './filters'

const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ── Token JWT (lido do localStorage) ─────────────────────────────────────────
function getToken(): string {
  return localStorage.getItem('larbras_token') ?? ''
}

// ── Fetch autenticado ─────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res   = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (res.status === 401) {
    // Token expirado — força reload para cair na tela de login
    localStorage.removeItem('larbras_token')
    window.location.reload()
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Fetch de dados de vendas ──────────────────────────────────────────────────
export async function fetchSalesData(): Promise<SaleRow[]> {
  if (!USE_API) {
    const { loadRows } = await import('./db')
    return loadRows()
  }

  const data = await apiFetch<{ rows: (Omit<SaleRow, '_date'> & { _date: string })[] }>('/sales')

  // Converte _date string → Date
  return data.rows.map(r => ({
    ...r,
    _date: r._date ? new Date(r._date + 'T00:00:00') : null,
  })) as SaleRow[]
}

// ── Query paginada ────────────────────────────────────────────────────────────
export async function querySales(params: {
  filters:  FilterState
  page:     number
  pageSize: number
  sortBy?:  string
  sortDir?: 'asc' | 'desc'
}): Promise<Paginated<SaleRow>> {
  if (!USE_API) {
    const { loadRows } = await import('./db')
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
    return { items: sorted.slice(start, start + params.pageSize), total, page: params.page, pageSize: params.pageSize, totalPages }
  }

  return apiFetch<Paginated<SaleRow>>('/sales/query', {
    method: 'POST',
    body:   JSON.stringify(params),
  })
}

// ── Upload de arquivo XLSX (modo API) ─────────────────────────────────────────
export async function uploadFile(file: File, mode: 'replace' | 'append' = 'append'): Promise<{ inserted: number }> {
  if (!USE_API) throw new Error('uploadFile: use parser.ts para modo local')

  const token    = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/api/sales/upload?mode=${mode}`, {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Proxy de IA: chama o backend que repassa para o provedor ──────────────────
// Usado por aiProviders.ts quando VITE_USE_API=true
export async function callAIBackend(provider: 'claude' | 'gemini' | 'groq', body: unknown): Promise<unknown> {
  return apiFetch(`/ai/${provider}`, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

// ── Tabela de colunas ─────────────────────────────────────────────────────────
export const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { key: '_date',     header: 'Data',       sortable: true, format: 'date',     width: '110px' },
  { key: '_cliente',  header: 'Cliente',    sortable: true, format: 'text',     width: '200px' },
  { key: '_produto',  header: 'Produto',    sortable: true, format: 'text'                     },
  { key: '_marca',    header: 'Marca',      sortable: true, format: 'text',     width: '120px' },
  { key: '_vendedor', header: 'Vendedor',   sortable: true, format: 'text',     width: '130px' },
  { key: '_bairro',   header: 'Localidade', sortable: true, format: 'text',     width: '130px' },
  { key: '_qtd',      header: 'Qtd',        sortable: true, format: 'integer',  width: '70px',  align: 'right' },
  { key: '_val',      header: 'Valor',      sortable: true, format: 'currency', width: '120px', align: 'right' },
]
