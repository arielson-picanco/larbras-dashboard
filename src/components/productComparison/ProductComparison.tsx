// ============================================================
// MÓDULO 10 — Comparação de Produtos + Estratégias de Venda IA
// ============================================================

import { useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, Legend,
} from 'recharts'
import { useDashboardStore }           from '@/store/useDashboardStore'
import { formatCurrency, formatMonth } from '@/services/analytics'
import { callAI, getConfiguredProviders, PROVIDERS } from '@/services/aiProviders'
import { exportProductReport }         from './reportExport'
import {
  X, Plus, Package, TrendingUp, ShoppingCart, Receipt,
  Users, Sparkles, RefreshCw, Download, Zap, ChevronDown,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_SELECT = 5
const COLORS = ['#f5a623','#5b8dee','#22d3a0','#9b7bea','#fb923c','#f06b6b','#2dd4bf','#e879a8']

const ttStyle = {
  background:'#161929', border:'1px solid rgba(91,141,238,.35)',
  borderRadius:10, padding:'10px 14px', fontSize:11, color:'#e2e8f0',
  boxShadow:'0 16px 40px rgba(0,0,0,.65)', fontFamily:"'DM Sans', system-ui",
}
const ttLabel = { color:'#c4d1e0', fontSize:11, fontWeight:600, marginBottom:4 }
const ttItem  = { color:'#e2e8f0', padding:'1px 0' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortProd(name: string, max = 22): string {
  return name.length > max ? name.slice(0, max) + '…' : name
}

// ── Product Picker ────────────────────────────────────────────────────────────
function ProductPicker({ all, selected, onToggle, colors }: {
  all:      { name: string; total: number }[]
  selected: string[]
  onToggle: (v: string) => void
  colors:   string[]
}) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const filtered = all.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'7px 14px', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
      >
        <Plus size={13} /> Adicionar produto
      </button>

      {open && (
        <div
          style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--bg-modal)', border:'1px solid var(--border-default)', borderRadius:12, zIndex:500, width:340, boxShadow:'0 16px 40px rgba(0,0,0,.5)', animation:'fadeIn .15s ease', overflow:'hidden' }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border-subtle)' }}>
            <input autoFocus type="text" placeholder="Buscar produto…" value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ width:'100%', fontSize:12 }} />
          </div>
          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {filtered.map((p) => {
              const isSel = selected.includes(p.name)
              const idx   = selected.indexOf(p.name)
              const atMax = !isSel && selected.length >= MAX_SELECT
              return (
                <button key={p.name} disabled={atMax}
                  onClick={() => { onToggle(p.name); if (!isSel) setOpen(false) }}
                  style={{ width:'100%', background:'none', border:'none', padding:'8px 14px', display:'flex', alignItems:'center', gap:10, cursor: atMax?'not-allowed':'pointer', textAlign:'left', opacity: atMax?0.4:1, transition:'background .1s' }}
                  onMouseOver={(e) => { if (!atMax) e.currentTarget.style.background='var(--bg-card2)' }}
                  onMouseOut={(e)  => { e.currentTarget.style.background='none' }}
                >
                  {isSel ? (
                    <span style={{ width:14, height:14, borderRadius:3, background:colors[idx], flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={9} color="#fff" /></span>
                  ) : (
                    <span style={{ width:14, height:14, borderRadius:3, border:'1px solid var(--border-default)', flexShrink:0 }} />
                  )}
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontSize:11, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:"'IBM Plex Mono'" }}>{formatCurrency(p.total)}</div>
                  </div>
                </button>
              )
            })}
          </div>
          {selected.length >= MAX_SELECT && (
            <div style={{ padding:'7px 14px', fontSize:10, color:'var(--warning)', borderTop:'1px solid var(--border-subtle)' }}>Máximo de {MAX_SELECT} produtos</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AI Strategy Panel ─────────────────────────────────────────────────────────
function AIStrategyPanel({ productData, provider }: {
  productData: ReturnType<typeof buildProductData>[number][]
  provider:    string
}) {
  const [strategies, setStrategies] = useState<null | {
    resumo:     string
    estrategias: { titulo: string; tipo: 'kit' | 'cross' | 'upsell' | 'promo'; descricao: string; produtos: string[]; impacto: string }[]
  }>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true); setError(null)

    const summary = productData.map((p) =>
      `PRODUTO: ${p.name} | Marca: ${p.brand} | Receita: ${formatCurrency(p.total)} | ${p.orders} vendas | Ticket: ${formatCurrency(p.ticket)} | ${p.uniqueClients} clientes únicos | Top bairros: ${p.topBairros.join(', ')}`
    ).join('\n')

    const bundlePairs = productData.flatMap((p) =>
      p.coPurchases.slice(0, 3).map((cp) => `${p.name} + ${cp.name} (${cp.count}x juntos)`)
    ).join('\n')

    const prompt = `Você é especialista em estratégias de vendas para varejo de móveis e eletrodomésticos em Manaus/AM.

PRODUTOS EM ANÁLISE:
${summary}

PRODUTOS FREQUENTEMENTE COMPRADOS JUNTOS:
${bundlePairs || 'Poucos dados de co-compra disponíveis'}

Gere estratégias práticas e criativas de vendas. Responda SOMENTE JSON puro:
{
  "resumo": "2 frases sobre o potencial de vendas cruzadas",
  "estrategias": [
    {
      "titulo": "nome da estratégia (max 8 palavras)",
      "tipo": "kit|cross|upsell|promo",
      "descricao": "como executar a estratégia em 3-4 frases com dados reais",
      "produtos": ["produto1", "produto2"],
      "impacto": "estimativa ex: +20% ticket médio"
    }
  ]
}

Tipos de estratégia:
- kit: vender produtos juntos em pacote com desconto
- cross: sugerir produto complementar no momento da compra
- upsell: oferecer versão premium ou maior do mesmo produto
- promo: promoção sazonal ou por volume

Gere exatamente 4 estratégias cobrindo diferentes tipos. Use nomes reais dos produtos. Foque no mercado de Manaus/AM.`

    try {
      const text = await callAI(provider as never, prompt)
      setStrategies(JSON.parse(text))
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [productData, provider])

  const TIPO_META = {
    kit:   { label: 'Kit/Pacote',         color: '#22d3a0', bg: 'rgba(34,211,160,.1)',  icon: Package },
    cross: { label: 'Venda Cruzada',      color: '#5b8dee', bg: 'rgba(91,141,238,.1)',  icon: Zap     },
    upsell:{ label: 'Upgrade',            color: '#f5a623', bg: 'rgba(245,166,35,.1)',  icon: TrendingUp },
    promo: { label: 'Promoção',           color: '#fb923c', bg: 'rgba(251,146,60,.1)',  icon: ShoppingCart },
  }

  const currProvider = PROVIDERS.find((p) => p.id === provider)

  return (
    <div className="card" style={{ padding:'1rem 1.1rem', marginTop:'.75rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:7 }}>
            <Sparkles size={14} style={{ color:'var(--accent)' }} />
            Estratégias de Vendas com IA
          </div>
          <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>
            Kits, venda cruzada e upsell baseados nos dados reais
          </div>
        </div>
        <button onClick={generate} disabled={loading || !provider}
          style={{ background: loading?'var(--bg-card2)':currProvider?.color ?? 'var(--accent)', border:'none', color: loading?'var(--text-secondary)':'#0b0d18', borderRadius:8, padding:'7px 16px', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:6 }}
        >
          {loading ? <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
          {loading ? 'Gerando…' : generated ? 'Reanalisar' : 'Gerar Estratégias'}
        </button>
      </div>

      {error && <div style={{ padding:'10px 14px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.25)', borderRadius:8, color:'var(--danger)', fontSize:12, marginBottom:10 }}>{error}</div>}

      {loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background:'var(--bg-card2)', borderRadius:8, padding:'14px', height:120 }}>
              {[50,70,90,60].map((w,j) => <div key={j} style={{ height:9, background:'var(--bg-card)', borderRadius:3, marginBottom:8, width:`${w}%`, opacity:1-j*.15 }} />)}
            </div>
          ))}
        </div>
      )}

      {!loading && strategies && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          <div style={{ padding:'10px 14px', background:'rgba(245,166,35,.06)', border:'1px solid rgba(245,166,35,.2)', borderRadius:8, marginBottom:12 }}>
            <p style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.65, margin:0 }}>{strategies.resumo}</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:8 }}>
            {strategies.estrategias.map((s, i) => {
              const meta = TIPO_META[s.tipo] ?? TIPO_META.cross
              const Icon = meta.icon
              return (
                <div key={i} style={{ background:meta.bg, border:`1px solid ${meta.color}30`, borderRadius:10, padding:'12px 14px', animation:`fadeIn .25s ease ${i*.07}s both` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                    <Icon size={13} style={{ color:meta.color, flexShrink:0 }} />
                    <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:meta.color }}>{meta.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:9, color:'#22d3a0', fontWeight:700 }}>{s.impacto}</span>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:6, lineHeight:1.3 }}>{s.titulo}</div>
                  <p style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.6, margin:'0 0 8px' }}>{s.descricao}</p>
                  {s.produtos?.length > 0 && (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {s.produtos.map((prod, pi) => (
                        <span key={pi} style={{ fontSize:9, background:`${meta.color}15`, color:meta.color, padding:'2px 7px', borderRadius:4, fontWeight:600 }}>
                          {shortProd(prod, 25)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && !strategies && !error && (
        <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-secondary)', fontSize:12, background:'var(--bg-card2)', borderRadius:8, border:'1px dashed var(--border-subtle)' }}>
          Clique em <strong style={{ color:'var(--accent)' }}>Gerar Estratégias</strong> para obter sugestões de kits, venda cruzada e upsell
        </div>
      )}
    </div>
  )
}

// ── Data builder ──────────────────────────────────────────────────────────────
function buildProductData(names: string[], filteredRows: ReturnType<typeof useDashboardStore>['filteredRows']) {
  return names.map((name, idx) => {
    const rows        = filteredRows.filter((r) => r._produto === name)
    const total       = rows.reduce((s, r) => s + r._val, 0)
    const orders      = rows.length
    const qty         = rows.reduce((s, r) => s + r._qtd, 0)
    const ticket      = orders ? total / orders : 0
    const uniqueClients = new Set(rows.map((r) => r._cliente)).size
    const brand       = rows[0]?._marca ?? 'N/D'
    const color       = COLORS[idx]

    // Top bairros
    const bairroMap = new Map<string, number>()
    rows.forEach((r) => bairroMap.set(r._bairro, (bairroMap.get(r._bairro) ?? 0) + r._val))
    const topBairros = [...bairroMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([n]) => n)

    // Daily revenue
    const dateMap = new Map<string, number>()
    rows.forEach((r) => {
      if (!r._date) return
      const k = r._date.toISOString().slice(0,10)
      dateMap.set(k, (dateMap.get(k) ?? 0) + r._val)
    })
    const byDate = [...dateMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date,value]) => ({ date, value }))

    // Co-purchases: other products bought by same client on same date
    const coPurchaseMap = new Map<string, number>()
    rows.forEach((r) => {
      const sameClientSameDay = filteredRows.filter(
        (o) => o !== r && o._cliente === r._cliente &&
        o._date && r._date &&
        o._date.toISOString().slice(0,10) === r._date.toISOString().slice(0,10) &&
        o._produto !== name
      )
      sameClientSameDay.forEach((o) => {
        coPurchaseMap.set(o._produto, (coPurchaseMap.get(o._produto) ?? 0) + 1)
      })
    })
    const coPurchases = [...coPurchaseMap.entries()]
      .sort((a,b) => b[1]-a[1]).slice(0,5)
      .map(([n,count]) => ({ name: n, count }))

    return { name, color, total, orders, qty, ticket, uniqueClients, brand, topBairros, byDate, coPurchases }
  })
}

type ProductData = ReturnType<typeof buildProductData>[number]

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, icon: Icon, values, format }: {
  label:  string
  icon:   React.ElementType
  values: { name: string; value: number; color: string }[]
  format: 'currency' | 'integer'
}) {
  const fmt = (v: number) => format === 'currency' ? formatCurrency(v) : v.toLocaleString('pt-BR')
  const max = Math.max(...values.map((v) => v.value), 1)
  return (
    <div className="card" style={{ padding:'1rem 1.1rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <Icon size={13} style={{ color:'var(--text-secondary)' }} />
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>{label}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {values.map((v) => (
          <div key={v.name}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:10, color:v.color, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }}>{shortProd(v.name, 20)}</span>
              <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:'var(--text-primary)', fontWeight:700, flexShrink:0 }}>{fmt(v.value)}</span>
            </div>
            <div style={{ height:4, background:'var(--bg-card2)', borderRadius:2 }}>
              <div style={{ width:`${(v.value/max)*100}%`, height:'100%', background:v.color, borderRadius:2, transition:'width .8s cubic-bezier(.4,0,.2,1)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ProductComparison() {
  const { filteredRows, allRows, derived } = useDashboardStore()
  const configured = getConfiguredProviders()
  const [aiProvider, setAiProvider] = useState(configured[0]?.id ?? 'gemini')
  const [selected,   setSelected]   = useState<string[]>([])

  const allProducts = useMemo(() => {
    const map = new Map<string, number>()
    allRows.forEach((r) => {
      if (r._produto && r._produto !== 'Produto')
        map.set(r._produto, (map.get(r._produto) ?? 0) + r._val)
    })
    return [...map.entries()].sort((a,b) => b[1]-a[1]).map(([name, total]) => ({ name, total }))
  }, [allRows])

  const toggle = (v: string) =>
    setSelected((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < MAX_SELECT ? [...prev, v] : prev)

  const productData: ProductData[] = useMemo(
    () => selected.length ? buildProductData(selected, filteredRows) : [],
    [selected, filteredRows]
  )

  const radarData = useMemo(() => {
    if (!productData.length) return []
    const max = {
      total:  Math.max(...productData.map((v) => v.total),  1),
      orders: Math.max(...productData.map((v) => v.orders), 1),
      ticket: Math.max(...productData.map((v) => v.ticket), 1),
      qty:    Math.max(...productData.map((v) => v.qty),    1),
      cli:    Math.max(...productData.map((v) => v.uniqueClients), 1),
    }
    return [
      { metric:'Faturamento',   ...Object.fromEntries(productData.map((v) => [shortProd(v.name,16), Math.round((v.total  /max.total )*100)])) },
      { metric:'Pedidos',       ...Object.fromEntries(productData.map((v) => [shortProd(v.name,16), Math.round((v.orders /max.orders)*100)])) },
      { metric:'Ticket Médio',  ...Object.fromEntries(productData.map((v) => [shortProd(v.name,16), Math.round((v.ticket /max.ticket)*100)])) },
      { metric:'Unidades',      ...Object.fromEntries(productData.map((v) => [shortProd(v.name,16), Math.round((v.qty    /max.qty   )*100)])) },
      { metric:'Clientes Únicos',...Object.fromEntries(productData.map((v) => [shortProd(v.name,16), Math.round((v.uniqueClients/max.cli)*100)])) },
    ]
  }, [productData])

  const timelineData = useMemo(() => {
    if (!productData.length) return []
    const allDates = new Set<string>()
    productData.forEach((v) => v.byDate.forEach((d) => allDates.add(d.date)))
    return [...allDates].sort().map((date) => ({
      date,
      ...Object.fromEntries(productData.map((v) => {
        const found = v.byDate.find((d) => d.date === date)
        return [shortProd(v.name,16), found?.value ?? 0]
      })),
    }))
  }, [productData])

  if (!allRows.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'5rem 2rem', gap:16 }}>
        <Package size={32} style={{ color:'var(--text-tertiary)' }} />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Importe dados para comparar produtos</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'1rem', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Package size={15} style={{ color:'var(--accent)' }} />
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Comparação de Produtos</span>
          <span style={{ fontSize:11, color:'var(--text-secondary)' }}>— até {MAX_SELECT} produtos</span>
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
          {selected.map((v, i) => (
            <div key={v} style={{ display:'flex', alignItems:'center', gap:6, background:`${COLORS[i]}18`, border:`1px solid ${COLORS[i]}40`, borderRadius:20, padding:'4px 10px', fontSize:10, color:COLORS[i], fontWeight:600, animation:'fadeIn .2s ease' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:COLORS[i], flexShrink:0 }} />
              {shortProd(v, 24)}
              <button onClick={() => toggle(v)} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS[i], display:'flex', padding:0 }}><X size={10} /></button>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* AI Provider selector */}
          {configured.length > 0 && (
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="select-field"
              style={{ fontSize:11, minWidth:120, appearance:'none', padding:'5px 28px 5px 10px' }}
            >
              {configured.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}

          {/* Download report */}
          {productData.length > 0 && (
            <button
              onClick={() => exportProductReport(productData, derived)}
              style={{ background:'var(--bg-card2)', border:'1px solid var(--border-default)', color:'var(--text-primary)', borderRadius:8, padding:'7px 12px', fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
            >
              <Download size={13} /> Baixar Relatório
            </button>
          )}

          <ProductPicker all={allProducts} selected={selected} onToggle={toggle} colors={COLORS} />
        </div>
      </div>

      {!selected.length && (
        <div className="card" style={{ padding:'4rem 2rem', textAlign:'center' }}>
          <Package size={32} style={{ color:'var(--text-tertiary)', display:'block', margin:'0 auto 12px' }} />
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6 }}>
            Clique em <strong style={{ color:'var(--accent)' }}>Adicionar produto</strong> para iniciar a comparação
          </div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{allProducts.length} produtos disponíveis · selecione até {MAX_SELECT}</div>
        </div>
      )}

      {selected.length > 0 && (
        <>
          {/* KPI metrics */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:'.75rem', marginBottom:'.75rem' }}>
            <MetricCard label="Faturamento Total"      icon={TrendingUp}   values={productData.map((v) => ({ name:v.name, value:v.total,          color:v.color }))} format="currency" />
            <MetricCard label="Ticket Médio por Pedido" icon={Receipt}      values={productData.map((v) => ({ name:v.name, value:v.ticket,         color:v.color }))} format="currency" />
            <MetricCard label="Número de Pedidos"       icon={ShoppingCart} values={productData.map((v) => ({ name:v.name, value:v.orders,         color:v.color }))} format="integer"  />
            <MetricCard label="Clientes Únicos"         icon={Users}        values={productData.map((v) => ({ name:v.name, value:v.uniqueClients,  color:v.color }))} format="integer"  />
          </div>

          {/* Radar + Timeline */}
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1.6fr)', gap:'.75rem', marginBottom:'.75rem' }}>
            <div className="card" style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem', display:'flex', justifyContent:'space-between' }}>
                <span>Perfil Comparativo</span>
                <span style={{ fontSize:9, fontWeight:400, color:'var(--text-tertiary)' }}>escala 0–100</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} margin={{ top:8, right:24, bottom:8, left:24 }}>
                  <PolarGrid stroke="rgba(45,52,84,.8)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill:'#94a8bf', fontSize:9, fontFamily:"'DM Sans'" }} />
                  {productData.map((v) => (
                    <Radar key={v.name} name={shortProd(v.name,16)} dataKey={shortProd(v.name,16)} stroke={v.color} fill={v.color} fillOpacity={0.1} strokeWidth={2} />
                  ))}
                  <Legend iconType="circle" iconSize={7} formatter={(val) => <span style={{ fontSize:9, color:'#94a8bf' }}>{val}</span>} />
                  <Tooltip contentStyle={ttStyle} labelStyle={ttLabel} itemStyle={ttItem} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {timelineData.length > 1 ? (
              <div className="card" style={{ padding:'1rem 1.1rem' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>
                  Evolução de Receita no Período
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData} margin={{ top:4, right:4, bottom:0, left:0 }}>
                    <defs>
                      {productData.map((v) => (
                        <linearGradient key={v.name} id={`pg_${v.name.slice(0,6).replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={v.color} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={v.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" />
                    <XAxis dataKey="date" tickFormatter={formatMonth} tick={{ fill:'#94a8bf', fontSize:9, fontFamily:"'IBM Plex Mono'" }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(timelineData.length/5)-1)} />
                    <YAxis tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0','R$')} tick={{ fill:'#94a8bf', fontSize:9, fontFamily:"'IBM Plex Mono'" }} axisLine={false} tickLine={false} width={82} />
                    <Tooltip formatter={(val:number,name:string) => [formatCurrency(val),name]} labelFormatter={(l) => `Data: ${l}`} contentStyle={ttStyle} labelStyle={ttLabel} itemStyle={ttItem} />
                    {productData.map((v) => (
                      <Area key={v.name} type="monotone" dataKey={shortProd(v.name,16)} stroke={v.color} strokeWidth={2} fill={`url(#pg_${v.name.slice(0,6).replace(/\s/g,'')})`} dot={false} activeDot={{ r:4, fill:v.color, stroke:'#161929', strokeWidth:2 }} />
                    ))}
                    <Legend iconType="circle" iconSize={7} formatter={(val) => <span style={{ fontSize:9, color:'#94a8bf' }}>{val}</span>} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card" style={{ padding:'1rem 1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Sem dados temporais suficientes</div>
              </div>
            )}
          </div>

          {/* Co-purchases */}
          <div className="card" style={{ padding:'1rem 1.1rem', marginBottom:'.75rem' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>
              Produtos Comprados Junto (Co-compras)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(selected.length,3)},minmax(0,1fr))`, gap:12 }}>
              {productData.map((v) => (
                <div key={v.name}>
                  <div style={{ fontSize:10, fontWeight:700, color:v.color, marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shortProd(v.name,28)}</div>
                  {v.coPurchases.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {v.coPurchases.map((cp,i) => (
                        <div key={cp.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:"'IBM Plex Mono'", minWidth:20, textAlign:'right' }}>{cp.count}x</span>
                          <span style={{ fontSize:10, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{cp.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>Sem co-compras registradas</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Brand + Bairro breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:'.75rem', marginBottom:'.75rem' }}>
            <div className="card" style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>Marca</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {productData.map((v) => (
                  <div key={v.name} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:v.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{shortProd(v.name,22)}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:v.color, flexShrink:0 }}>{v.brand}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>Top Bairros de Venda</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {productData.map((v) => (
                  <div key={v.name}>
                    <div style={{ fontSize:9, color:v.color, fontWeight:700, marginBottom:4 }}>{shortProd(v.name,22)}</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {v.topBairros.map((b) => (
                        <span key={b} style={{ fontSize:9, background:`${v.color}15`, color:v.color, padding:'2px 7px', borderRadius:4, fontWeight:600 }}>{b}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Strategies */}
          {configured.length > 0 ? (
            <AIStrategyPanel productData={productData} provider={aiProvider} />
          ) : (
            <div className="card" style={{ padding:'1.5rem', display:'flex', alignItems:'center', gap:12 }}>
              <Sparkles size={20} style={{ color:'var(--text-tertiary)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>Estratégias de Venda com IA</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Configure uma chave de API (Gemini, Groq ou Claude) no .env.local para gerar estratégias automáticas</div>
              </div>
            </div>
          )}

          {/* Summary table */}
          <div className="card" style={{ overflow:'hidden', marginTop:'.75rem' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>
              Resumo Comparativo
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                  {['Produto','Marca','Receita','Pedidos','Ticket Médio','Unid.','Clientes','% Total'].map((h,i) => (
                    <th key={h} style={{ padding:'7px 12px', textAlign: i>1?'right':'left', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productData.slice().sort((a,b) => b.total-a.total).map((v) => {
                  const pct = derived?.totalRevenue ? ((v.total/derived.totalRevenue)*100).toFixed(1) : '0.0'
                  return (
                    <tr key={v.name} style={{ borderBottom:'1px solid var(--border-subtle)', transition:'background .1s' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = `${v.color}08`)}
                      onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding:'7px 12px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:v.color, flexShrink:0 }} />
                          <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{shortProd(v.name,28)}</span>
                        </div>
                      </td>
                      <td style={{ padding:'7px 12px', fontSize:10, color:'var(--text-secondary)' }}>{v.brand}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:v.color, fontFamily:"'IBM Plex Mono'", fontWeight:700, fontSize:11 }}>{formatCurrency(v.total)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'" }}>{v.orders}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-primary)', fontFamily:"'IBM Plex Mono'", fontSize:11 }}>{formatCurrency(v.ticket)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'" }}>{v.qty}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'" }}>{v.uniqueClients}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
                          <div style={{ width:40, height:4, background:'var(--bg-card2)', borderRadius:2 }}>
                            <div style={{ width:`${pct}%`, height:'100%', background:v.color, borderRadius:2 }} />
                          </div>
                          <span style={{ fontSize:9, color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'", minWidth:32 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
