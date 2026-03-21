// ============================================================
// App.tsx — raiz da aplicação
// ============================================================

import { useEffect } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { loadRows }          from '@/services/db'
import { Header }            from '@/components/layout/Header'
import { TabNav }            from '@/components/layout/TabNav'
import { FilterBar }         from '@/components/filters/FilterBar'
import { ImportModal }       from '@/components/import/ImportModal'
import { AIInsights }        from '@/components/insights/AIInsights'
import { VendorComparison }  from '@/components/comparison/VendorComparison'
import { ProductComparison } from '@/components/productComparison/ProductComparison'
import { MarkupPage }        from '@/components/markup/MarkupPage'
import { FeiraoPlanner }     from '@/components/feirao/FeiraoPlanner'
import { BairroHeatmap }     from '@/components/heatmap/BairroHeatmap'
import {
  OverviewPage, ProductsPage, SellersPage, ClientsPage, TablePage,
} from '@/pages'

export default function App() {
  const { theme, activeTab, setAllRows, setLoading } = useDashboardStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark',  theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  useEffect(() => {
    setLoading(true)
    loadRows()
      .then((rows) => { if (rows.length) setAllRows(rows) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Header />
      <TabNav />
      {activeTab !== 'markup' && activeTab !== 'feirao' && <FilterBar />}

      <main style={{ padding: '1rem 1.5rem' }}>
        {activeTab === 'overview'  && <OverviewPage />}
        {activeTab === 'products'  && <ProductsPage />}
        {activeTab === 'sellers'   && <SellersPage />}
        {activeTab === 'comparison'        && <VendorComparison />}
        {activeTab === 'productComparison' && <ProductComparison />}
        {activeTab === 'markup'           && <MarkupPage />}
        {activeTab === 'feirao'           && <FeiraoPlanner />}
        {activeTab === 'clients'   && <ClientsPage />}
        {activeTab === 'heatmap'   && <BairroHeatmap />}
        {activeTab === 'insights'  && <AIInsights />}
        {activeTab === 'table'     && <TablePage />}
      </main>

      <ImportModal />
    </div>
  )
}
