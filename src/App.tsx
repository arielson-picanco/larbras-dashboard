// ============================================================
// App.tsx — raiz da aplicação (com autenticação e roles)
// ============================================================

import { useEffect } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { useAuth }           from '@/contexts/AuthContext'
import { LoginPage }         from '@/pages/LoginPage'
import { Header }            from '@/components/layout/Header'
import { TabNav }            from '@/components/layout/TabNav'
import { FilterBar }         from '@/components/filters/FilterBar'
import { ImportModal }       from '@/components/import/ImportModal'
import { AIInsights }        from '@/components/insights/AIInsights'
import { VendorComparison }  from '@/components/comparison/VendorComparison'
import { ProductComparison } from '@/components/productComparison/ProductComparison'
import { MarkupPage }        from '@/components/markup/MarkupPage'
import { FeiraoPlanner }     from '@/components/feirao/FeiraoPlanner'
import { OmieSync }          from '@/components/omie/OmieSync'
import { UserManagement }    from '@/components/admin/UserManagement'
import { BairroHeatmap }     from '@/components/heatmap/BairroHeatmap'
import {
  OverviewPage, ProductsPage, SellersPage, ClientsPage, TablePage,
} from '@/pages'

// Abas que pertencem a cada role (só a primeira aba disponível abre por padrão)
const DEFAULT_TAB: Record<string, string> = {
  admin:     'overview',
  gerente:   'products',
  marketing: 'products',
}

export default function App() {
  const { theme, activeTab, setActiveTab, setAllRows, setLoading } = useDashboardStore()
  const { user, loading: authLoading } = useAuth()

  // Aplica tema
  useEffect(() => {
    document.documentElement.classList.toggle('dark',  theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // Ao fazer login, salta para a aba padrão do role
  useEffect(() => {
    if (user) {
      const defaultTab = DEFAULT_TAB[user.role] ?? 'overview'
      setActiveTab(defaultTab)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega dados do backend (Supabase) ou IndexedDB conforme modo
  useEffect(() => {
    if (!user) return

    const USE_API = import.meta.env.VITE_USE_API === 'true'
    setLoading(true)

    if (USE_API) {
      // Modo API: busca do backend (1.309+ registros do Omiê no Supabase)
      import('@/services/api')
        .then(({ fetchSalesData }) => fetchSalesData())
        .then((rows) => { if (rows.length) setAllRows(rows) })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      // Modo local: carrega do IndexedDB
      import('@/services/db')
        .then(({ loadRows }) => loadRows())
        .then((rows) => { if (rows.length) setAllRows(rows) })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tela de loading do auth
  if (authLoading) {
    return (
      <div style={{
        minHeight:      '100vh',
        background:     'var(--bg-primary)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width:        32, height: 32,
          border:       '3px solid var(--border-default)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation:    'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  // Tela de login se não autenticado
  if (!user) return <LoginPage />

  const noFilterTabs = ['markup', 'feirao', 'omie', 'users']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Header />
      <TabNav />
      {!noFilterTabs.includes(activeTab) && <FilterBar />}

      <main style={{ padding: '1rem 1.5rem' }}>
        {activeTab === 'overview'          && <OverviewPage />}
        {activeTab === 'products'          && <ProductsPage />}
        {activeTab === 'sellers'           && <SellersPage />}
        {activeTab === 'comparison'        && <VendorComparison />}
        {activeTab === 'productComparison' && <ProductComparison />}
        {activeTab === 'markup'            && <MarkupPage />}
        {activeTab === 'feirao'            && <FeiraoPlanner />}
        {activeTab === 'clients'           && <ClientsPage />}
        {activeTab === 'heatmap'           && <BairroHeatmap />}
        {activeTab === 'insights'          && <AIInsights />}
        {activeTab === 'table'             && <TablePage />}
        {activeTab === 'omie'              && <OmieSync />}
        {activeTab === 'users'             && <UserManagement />}
      </main>

      {/* ImportModal apenas para admin */}
      {user.role === 'admin' && <ImportModal />}
    </div>
  )
}
