// ============================================================
// MÓDULO 7 — Testes unitários (Vitest)
// ============================================================

import { describe, it, expect } from 'vitest'
import { buildDerived }    from '../analytics'
import { applyFilters }    from '../filters'
import { parseNumericValue, autoDetectMapping, parseCSVText, mapToSaleRows } from '../parser'
import { DEFAULT_COL_DEFS } from '../store'
import type { SaleRow, FilterState } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function makeRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    _val: 1000, _cliente: 'Cliente A', _bairro: 'Centro',
    _produto: 'Mesa', _marca: 'MarcaX', _vendedor: 'João',
    _qtd: 2, _date: new Date('2024-03-15'), _raw: {},
    ...overrides,
  }
}

const defaultFilters: FilterState = {
  dateRange: { from: null, to: null },
  vendedor: '', produto: '', marca: '', bairro: '', search: '', period: 0,
}

// ── parseNumericValue ─────────────────────────────────────────────────────────
describe('parseNumericValue', () => {
  it('returns JS number as-is', () => {
    expect(parseNumericValue(1500.5)).toBe(1500.5)
    expect(parseNumericValue(1500)).toBe(1500)
    expect(parseNumericValue(0)).toBe(0)
  })

  it('parses Brazilian format with period-thousands and comma-decimal', () => {
    expect(parseNumericValue('1.500,00')).toBe(1500)
    expect(parseNumericValue('1.234.567,89')).toBe(1234567.89)
    expect(parseNumericValue('500,00')).toBe(500)
    expect(parseNumericValue('R$ 1.500,00')).toBe(1500)
  })

  it('parses US/plain format with dot-decimal', () => {
    expect(parseNumericValue('1500.50')).toBe(1500.5)
    expect(parseNumericValue('1500')).toBe(1500)
    expect(parseNumericValue('1,500.00')).toBe(1500)
  })

  it('returns 0 for empty or invalid values', () => {
    expect(parseNumericValue('')).toBe(0)
    expect(parseNumericValue(null)).toBe(0)
    expect(parseNumericValue(undefined)).toBe(0)
    expect(parseNumericValue('abc')).toBe(0)
  })

  it('handles values without decimal separator', () => {
    expect(parseNumericValue('800')).toBe(800)
    expect(parseNumericValue(800)).toBe(800)
  })
})

// ── buildDerived ──────────────────────────────────────────────────────────────
describe('buildDerived', () => {
  it('returns zero-filled structure for empty rows', () => {
    const d = buildDerived([])
    expect(d.totalRevenue).toBe(0)
    expect(d.totalOrders).toBe(0)
  })

  it('calculates totalRevenue correctly', () => {
    const d = buildDerived([makeRow({ _val: 500 }), makeRow({ _val: 1500 })])
    expect(d.totalRevenue).toBe(2000)
  })

  it('calculates avgTicket correctly', () => {
    const d = buildDerived([makeRow({ _val: 1000 }), makeRow({ _val: 3000 })])
    expect(d.avgTicket).toBe(2000)
  })

  it('groups by vendedor sorted by total desc', () => {
    const d = buildDerived([
      makeRow({ _vendedor: 'Maria', _val: 3000 }),
      makeRow({ _vendedor: 'João',  _val: 1000 }),
      makeRow({ _vendedor: 'Maria', _val: 2000 }),
    ])
    expect(d.byVendedor[0].name).toBe('Maria')
    expect(d.byVendedor[0].total).toBe(5000)
    expect(d.byVendedor[0].orders).toBe(2)
  })

  it('sums quantities in totalQty', () => {
    const d = buildDerived([makeRow({ _qtd: 3 }), makeRow({ _qtd: 5 })])
    expect(d.totalQty).toBe(8)
  })
})

// ── applyFilters ──────────────────────────────────────────────────────────────
describe('applyFilters', () => {
  const rows: SaleRow[] = [
    makeRow({ _vendedor: 'João',  _marca: 'MarcaA', _bairro: 'Centro', _date: new Date('2024-01-10') }),
    makeRow({ _vendedor: 'Maria', _marca: 'MarcaB', _bairro: 'Norte',  _date: new Date('2024-02-15') }),
    makeRow({ _vendedor: 'João',  _marca: 'MarcaA', _bairro: 'Sul',    _date: new Date('2024-03-20') }),
  ]

  it('returns all rows with no filters', () => {
    expect(applyFilters(rows, defaultFilters)).toHaveLength(3)
  })

  it('filters by vendedor', () => {
    const result = applyFilters(rows, { ...defaultFilters, vendedor: 'João' })
    expect(result).toHaveLength(2)
  })

  it('filters by date range', () => {
    const result = applyFilters(rows, {
      ...defaultFilters,
      dateRange: { from: new Date('2024-02-01'), to: new Date('2024-02-28') },
    })
    expect(result).toHaveLength(1)
  })

  it('chains multiple filters', () => {
    const result = applyFilters(rows, { ...defaultFilters, vendedor: 'João', marca: 'MarcaA' })
    expect(result).toHaveLength(2)
  })
})

// ── autoDetectMapping ─────────────────────────────────────────────────────────
describe('autoDetectMapping', () => {
  it('maps standard header names', () => {
    const defs = autoDetectMapping(['data','cliente','produto','valor','vendedor','marca','bairro','qtd'], DEFAULT_COL_DEFS)
    const get  = (key: string) => defs.find((d) => d.key === key)?.mapTo
    expect(get('data')).toBe('data')
    expect(get('valor')).toBe('valor')
  })

  it('detects synonym headers', () => {
    const defs = autoDetectMapping(['consultor','fabricante','quantidade'], DEFAULT_COL_DEFS)
    const get  = (key: string) => defs.find((d) => d.key === key)?.mapTo
    expect(get('vendedor')).toBe('consultor')
    expect(get('marca')).toBe('fabricante')
    expect(get('qtd')).toBe('quantidade')
  })
})

// ── parseCSVText ──────────────────────────────────────────────────────────────
describe('parseCSVText', () => {
  it('parses semicolon-separated CSV', () => {
    const { headers, rows } = parseCSVText('data;cliente;valor\n01/01/2024;João;1500\n02/01/2024;Maria;2000')
    expect(headers).toEqual(['data', 'cliente', 'valor'])
    expect(rows).toHaveLength(2)
  })

  it('handles quoted fields with commas', () => {
    const { rows } = parseCSVText('produto,valor\n"Mesa, Cadeira",1500\nArmário,800')
    expect(rows[0]['produto']).toBe('Mesa, Cadeira')
  })

  it('throws on single-line CSV', () => {
    expect(() => parseCSVText('apenas;um;header')).toThrow()
  })
})

// ── mapToSaleRows — valor parsing ─────────────────────────────────────────────
describe('mapToSaleRows — valor parsing', () => {
  const defs = DEFAULT_COL_DEFS.map((d) => {
    const m: Record<string, string> = {
      data: 'data', valor: 'valor', cliente: 'cliente', produto: 'produto',
      marca: 'marca', vendedor: 'vendedor', bairro: 'bairro', qtd: 'qtd',
    }
    return { ...d, mapTo: m[d.key] ?? '' }
  })

  const base = { data: '15/03/2024', cliente: 'A', produto: 'Mesa', marca: 'M', vendedor: 'João', bairro: 'Centro', qtd: '1' }

  it('correctly parses JS number from XLSX raw:true', () => {
    const rows = mapToSaleRows([{ ...base, valor: 1500.5 }], defs)
    expect(rows[0]._val).toBe(1500.5)
  })

  it('correctly parses BR format string "1.500,00"', () => {
    const rows = mapToSaleRows([{ ...base, valor: '1.500,00' }], defs)
    expect(rows[0]._val).toBe(1500)
  })

  it('correctly parses US format string "1500.50"', () => {
    const rows = mapToSaleRows([{ ...base, valor: '1500.50' }], defs)
    expect(rows[0]._val).toBe(1500.5)
  })

  it('does NOT convert "1500.50" to 150050 (original bug)', () => {
    const rows = mapToSaleRows([{ ...base, valor: '1500.50' }], defs)
    expect(rows[0]._val).not.toBe(150050)
    expect(rows[0]._val).toBe(1500.5)
  })

  it('correctly parses "R$ 1.500,00" with currency prefix', () => {
    const rows = mapToSaleRows([{ ...base, valor: 'R$ 1.500,00' }], defs)
    expect(rows[0]._val).toBe(1500)
  })

  it('filters out rows with valor = 0', () => {
    const rows = mapToSaleRows([{ ...base, valor: '0' }, { ...base, valor: '100' }], defs)
    expect(rows).toHaveLength(1)
    expect(rows[0]._val).toBe(100)
  })

  it('parses Brazilian date dd/MM/yyyy correctly', () => {
    const rows = mapToSaleRows([{ ...base, valor: 1000 }], defs)
    expect(rows[0]._date).toBeInstanceOf(Date)
    expect(rows[0]._date?.getDate()).toBe(15)
    expect(rows[0]._date?.getMonth()).toBe(2) // March = index 2
    expect(rows[0]._date?.getFullYear()).toBe(2024)
  })
})
