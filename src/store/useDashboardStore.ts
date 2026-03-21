// ============================================================
// MÓDULO 1 — Store Zustand
// Substitui todas as variáveis globais do HTML original:
// ALL_ROWS, ROWS, D, WB_STATE, CURRENT_PERIOD, COL_DEFS
// ============================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  SaleRow,
  FilterState,
  ColumnDef,
  DerivedData,
} from '@/types'
import { buildDerived } from '@/services/analytics'
import { applyFilters }  from '@/services/filters'

// ── Default column definitions (mirrors original COL_DEFS) ──────────────────
export const DEFAULT_COL_DEFS: ColumnDef[] = [
  { key: 'data',     label: 'Data',         active: true, mapTo: '', alts: ['data','date','datavenda','datapedido','dtvenda'],                                                       _builtin: true  },
  { key: 'valor',    label: 'Valor (R$)',    active: true, mapTo: '', alts: ['totalmercadoria','totalvenda','totalpedido','faturamento','receita','valor','total','preco','price'],    _builtin: true  },
  { key: 'cliente',  label: 'Cliente',       active: true, mapTo: '', alts: ['cliente','nome','razao','razaosocial','nomecliente','customer','name'],                                 _builtin: true  },
  { key: 'produto',  label: 'Produto',       active: true, mapTo: '', alts: ['produto','model','modelo','item','descricao','description','product','nomeproduto'],                   _builtin: true  },
  { key: 'marca',    label: 'Marca',         active: true, mapTo: '', alts: ['marca','brand','fabricante','fornecedor','manufacturer'],                                              _builtin: true  },
  { key: 'vendedor', label: 'Vendedor',      active: true, mapTo: '', alts: ['vendedor','consultor','atendente','operador','responsavel','seller','salesperson'],                    _builtin: true  },
  { key: 'bairro',   label: 'Localidade',    active: true, mapTo: '', alts: ['bairro','localidade','regiao','zona','distrito','cidade','district','neighborhood'],                   _builtin: true  },
  { key: 'qtd',      label: 'Quantidade',    active: true, mapTo: '', alts: ['qtd','quantidade','quantity','qty','volume','unidades'],                                               _builtin: true  },
]

// ── Default filters ──────────────────────────────────────────────────────────
const DEFAULT_FILTERS: FilterState = {
  dateRange: { from: null, to: null },
  vendedor:  '',
  produto:   '',
  marca:     '',
  bairro:    '',
  search:    '',
  period:    0,
}

// ── Store interface ──────────────────────────────────────────────────────────
interface DashboardState {
  // ── Data ──────────────────────────────────────────
  allRows:      SaleRow[]
  filteredRows: SaleRow[]
  derived:      DerivedData | null

  // ── Filters ───────────────────────────────────────
  filters:      FilterState

  // ── Column mapping ────────────────────────────────
  columnDefs:   ColumnDef[]

  // ── UI state ──────────────────────────────────────
  activeTab:    string
  isLoading:    boolean
  lastImport:   string | null    // ISO string (serializable)
  theme:        'dark' | 'light'
  importModalOpen: boolean

  // ── Actions ───────────────────────────────────────
  setAllRows:      (rows: SaleRow[]) => void
  setFilters:      (filters: Partial<FilterState>) => void
  resetFilters:    () => void
  setActiveTab:    (tab: string) => void
  setLoading:      (loading: boolean) => void
  setColumnDefs:   (defs: ColumnDef[]) => void
  toggleTheme:     () => void
  openImportModal: () => void
  closeImportModal:() => void
  clearData:       () => void

  // ── Derived helpers ───────────────────────────────
  getUniqueValues: (field: keyof SaleRow) => string[]
}

// ── Store implementation ─────────────────────────────────────────────────────
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      allRows:         [],
      filteredRows:    [],
      derived:         null,
      filters:         DEFAULT_FILTERS,
      columnDefs:      DEFAULT_COL_DEFS,
      activeTab:       'overview',
      isLoading:       false,
      lastImport:      null,
      theme:           'dark',
      importModalOpen: false,

      // ── Load data ──────────────────────────────────
      setAllRows: (rows) => {
        const filtered = applyFilters(rows, DEFAULT_FILTERS)
        set({
          allRows:      rows,
          filteredRows: filtered,
          derived:      buildDerived(filtered),
          lastImport:   new Date().toISOString(),
        })
      },

      // ── Apply filters ──────────────────────────────
      setFilters: (partial) => {
        const newFilters = { ...get().filters, ...partial }
        const filtered   = applyFilters(get().allRows, newFilters)
        set({
          filters:      newFilters,
          filteredRows: filtered,
          derived:      buildDerived(filtered),
        })
      },

      resetFilters: () => {
        const filtered = applyFilters(get().allRows, DEFAULT_FILTERS)
        set({
          filters:      DEFAULT_FILTERS,
          filteredRows: filtered,
          derived:      buildDerived(filtered),
        })
      },

      setActiveTab:     (tab)   => set({ activeTab: tab }),
      setLoading:       (v)     => set({ isLoading: v }),
      setColumnDefs:    (defs)  => set({ columnDefs: defs }),
      openImportModal:  ()      => set({ importModalOpen: true }),
      closeImportModal: ()      => set({ importModalOpen: false }),

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.classList.toggle('dark', next === 'dark')
      },

      clearData: () =>
        set({
          allRows:      [],
          filteredRows: [],
          derived:      null,
          lastImport:   null,
          filters:      DEFAULT_FILTERS,
        }),

      // ── Helpers ────────────────────────────────────
      getUniqueValues: (field) => {
        const values = get().allRows.map((r) => String(r[field] ?? ''))
        return [...new Set(values)].filter(Boolean).sort()
      },
    }),
    {
      name: 'larbras-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist only config, not data (IndexedDB handles data)
      partialize: (state) => ({
        columnDefs: state.columnDefs,
        filters:    state.filters,
        theme:      state.theme,
        activeTab:  state.activeTab,
      }),
    }
  )
)
