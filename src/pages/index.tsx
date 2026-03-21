// ============================================================
// MÓDULO 5 — Páginas / Painéis do dashboard  (v4)
// ============================================================

import { KPISection }      from '@/components/kpi/KPISection'
import { RevenueChart, ProductChart, SellerChart, BrandChart, LocationChart } from '@/components/charts/Charts'
import { DataTable }       from '@/components/table/DataTable'
import { ExportButton }    from '@/components/export/ExportButton'
import { useDashboardStore } from '@/store/useDashboardStore'
import { formatCurrency }  from '@/services/analytics'

function Row({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '.75rem', marginBottom: '.75rem' }}>
      {children}
    </div>
  )
}

function EmptyState() {
  const { openImportModal } = useDashboardStore()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📊</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhum dado carregado</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
          Importe um arquivo Excel ou CSV com os dados de vendas para começar a análise
        </div>
      </div>
      <button onClick={openImportModal} style={{ marginTop: 8, background: 'var(--accent)', border: 'none', color: '#0b0d18', borderRadius: 8, padding: '10px 24px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Importar dados
      </button>
    </div>
  )
}



// ── Visão Geral ───────────────────────────────────────────────────────────────
export function OverviewPage() {
  const { allRows } = useDashboardStore()
  if (!allRows.length) return <EmptyState />
  return (
    <div>
      <KPISection />
      <Row cols="minmax(0,1.7fr) minmax(0,1fr)">
        <RevenueChart />
        <BrandChart />
      </Row>
      <Row cols="minmax(0,1fr) minmax(0,1fr)">
        <LocationChart />
        <SellerChart />
      </Row>
    </div>
  )
}

// ── Produtos ──────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const { allRows, derived } = useDashboardStore()
  if (!allRows.length) return <EmptyState />

  return (
    <div>
      <KPISection />
      <Row cols="minmax(0,1fr) minmax(0,1fr)">
        <ProductChart />
        <BrandChart />
      </Row>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '.75rem' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          Ranking de Produtos
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['#', 'Produto', 'Receita', 'Pedidos', 'Ticket Médio', '% do Total'].map((h, i) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(derived?.byProduto ?? []).slice(0, 20).map((p, i) => {
              const total = derived?.totalRevenue ?? 1
              const pct   = ((p.total / total) * 100).toFixed(1)
              // Ticket médio do produto = receita do produto / pedidos do produto
              const ticketProd = p.orders > 0 ? p.total / p.orders : 0
              return (
                <tr key={p.name} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.04)')}
                  onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, width: 36 }}>{i + 1}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--accent)', fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(p.total)}
                  </td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>{p.orders}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, textAlign: 'right' }}>
                    {formatCurrency(ticketProd)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 4, background: 'var(--bg-card2)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'IBM Plex Mono'", minWidth: 36 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vendedores ────────────────────────────────────────────────────────────────
export function SellersPage() {
  const { allRows, derived } = useDashboardStore()
  if (!allRows.length) return <EmptyState />

  // Ticket médio geral por transação para comparação
  const ticketGeral = derived ? derived.avgTicket : 0

  return (
    <div>
      <KPISection />



      <Row cols="minmax(0,1fr) minmax(0,1fr)">
        <SellerChart />
        {/* Ranking com ticket médio por vendedor */}
        <div className="card" style={{ padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)', marginBottom: '.875rem' }}>
            Ticket Médio por Vendedor
            <div style={{ fontSize: 8, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Fórmula: Faturamento do Vendedor ÷ Nº de Pedidos do Vendedor
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(derived?.byVendedor ?? []).map((v) => {
              // Ticket médio por vendedor = faturamento vendedor / nº pedidos vendedor
              const ticketV  = v.orders > 0 ? v.total / v.orders : 0
              const aboveAvg = ticketV >= ticketGeral
              return (
                <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: '0 0 160px', fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.name}>
                    {v.name}
                  </span>
                  <span style={{ flex: '0 0 90px', fontSize: 11, fontFamily: "'IBM Plex Mono'", fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>
                    {formatCurrency(ticketV)}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: aboveAvg ? 'rgba(34,211,160,.12)' : 'rgba(240,107,107,.1)',
                    color:      aboveAvg ? 'var(--success)' : 'var(--danger)',
                    whiteSpace: 'nowrap',
                  }}>
                    {aboveAvg ? '↑ acima' : '↓ abaixo'}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'IBM Plex Mono'" }}>{v.orders}p</span>
                </div>
              )
            })}
          </div>
        </div>
      </Row>

      {/* Full seller table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          Tabela Completa de Vendedores
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['#', 'Vendedor', 'Faturamento', 'Pedidos', 'Ticket Médio', 'vs. Média', '% Total'].map((h, i) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(derived?.byVendedor ?? []).map((v, i) => {
              const ticketV   = v.orders > 0 ? v.total / v.orders : 0
              const vsMedia   = ticketGeral > 0 ? ((ticketV - ticketGeral) / ticketGeral) * 100 : 0
              const pct       = derived ? (v.total / derived.totalRevenue) * 100 : 0
              const aboveAvg  = ticketV >= ticketGeral
              return (
                <tr key={v.name} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)', transition: 'background .1s' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.04)')}
                  onMouseOut={(e)  => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)')}
                >
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, width: 36 }}>{i + 1}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--accent)', fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(v.total)}
                  </td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>{v.orders}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(ticketV)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono'",
                      color: aboveAvg ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {aboveAvg ? '+' : ''}{vsMedia.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <div style={{ width: 50, height: 4, background: 'var(--bg-card2)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--info)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'IBM Plex Mono'", minWidth: 36 }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Clientes ──────────────────────────────────────────────────────────────────
export function ClientsPage() {
  const { allRows, derived } = useDashboardStore()
  if (!allRows.length) return <EmptyState />

  const ticketPorCliente = derived?.avgTicketPerClient ?? 0
  const ticketPorPedido  = derived?.avgTicket ?? 0
  const uniqueClients    = derived?.uniqueClients ?? 0

  return (
    <div>
      <KPISection />



      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text-secondary)' }}>
          Top 10 Clientes por Receita
          <span style={{ fontSize: 8, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
            Ticket = Receita do Cliente ÷ Pedidos do Cliente
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['#', 'Cliente', 'Receita Total', 'Pedidos', 'Ticket Médio', 'vs. Média'].map((h, i) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(derived?.topClientes ?? []).map((c, i) => {
              // Ticket médio do cliente = receita do cliente / pedidos do cliente
              const ticketC  = c.orders > 0 ? c.total / c.orders : 0
              const vsMedia  = ticketPorCliente > 0 ? ((ticketC - ticketPorCliente) / ticketPorCliente) * 100 : 0
              const above    = ticketC >= ticketPorCliente
              return (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.04)')}
                  onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", fontSize: 10, width: 36 }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--accent)', fontFamily: "'IBM Plex Mono'", fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(c.total)}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>{c.orders}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(ticketC)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono'", color: above ? 'var(--success)' : 'var(--danger)' }}>
                      {above ? '+' : ''}{vsMedia.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Dados Detalhados ──────────────────────────────────────────────────────────
export function TablePage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '.75rem' }}>
        <ExportButton />
      </div>
      <DataTable />
    </div>
  )
}
