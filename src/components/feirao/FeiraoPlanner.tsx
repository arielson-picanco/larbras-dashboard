// ============================================================
// MÓDULO 12 — Planejador de Feirão
// Planejamento completo: produtos, kits, despesas, ponto de
// equilíbrio, projeção de lucro e estratégias com IA.
// ============================================================

import { useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { useDashboardStore }    from '@/store/useDashboardStore'
import { formatCurrency }       from '@/services/analytics'
import { callAIText, getConfiguredProviders, PROVIDERS } from '@/services/aiProviders'
import {
  Tag, Package, Calculator, TrendingUp, AlertTriangle,
  Plus, Trash2, Sparkles, RefreshCw,
  DollarSign, Target, Zap, ChevronDown, ChevronUp, Info,
  Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────
interface FairConfig {
  nome:            string
  data:            string
  local:           string
  metaReceita:     number
  // Despesas do evento
  aluguelLocal:    number
  marketing:       number
  pessoal:         number
  logistica:       number
  outros:          number
  // Impostos / operacional (herdado do markup mas ajustável p/ feirão)
  icms:            number
  pisCofins:       number
  despesasFixas:   number
  lucroMinimo:     number   // lucro mínimo aceitável no feirão
}

interface FairProduct {
  id:             string
  nome:           string
  marca:          string
  custo:          number
  precoNormal:    number   // preço fora do feirão
  precoFeirado:   number   // preço no feirão
  desconto:       number   // % calculado automaticamente
  qtdEstimada:    number
  // Calculados
  margemMin:      number   // margem no preço mínimo
  margemFeirado:  number   // margem real no preço feirão
  precoMinimo:    number   // preço abaixo do qual é prejuízo
  lucroPorUnid:   number
  receitaTotal:   number
  lucroTotal:     number
  status:         'lucro' | 'breakeven' | 'prejuizo'
}

interface Kit {
  id:       string
  nome:     string
  produtos: { productId: string; nome: string; qty: number; custo: number; precoFeirado: number }[]
  precoKit: number       // preço cobrado pelo kit
  desconto: number       // desconto vs soma individual
  // Calculados
  custoTotal:   number
  margemKit:    number
  lucroPorKit:  number
  qtdEstimada:  number
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#f5a623','#5b8dee','#22d3a0','#9b7bea','#fb923c','#f06b6b','#2dd4bf']

const ttStyle = {
  background:'#161929', border:'1px solid rgba(91,141,238,.35)',
  borderRadius:10, padding:'10px 14px', fontSize:11, color:'#e2e8f0',
  boxShadow:'0 16px 40px rgba(0,0,0,.65)', fontFamily:"'DM Sans', system-ui",
}

// ── Calculation helpers ───────────────────────────────────────────────────────
// Preço mínimo: menor preço que ainda cobre custo + despesas + lucro mínimo
// Fórmula: Custo ÷ (1 − totalPct%)  — markup BR padrão
function calcPrecoMinimo(custo: number, cfg: FairConfig): number {
  const despPct = cfg.icms + cfg.pisCofins + cfg.despesasFixas + cfg.lucroMinimo
  const fator   = 1 - despPct / 100
  return fator > 0 ? custo / fator : custo * 1.5
}

// Margem líquida % = ((PV − Custo) / PV × 100) − Despesas%
// Base sempre sobre o preço de venda (padrão contábil BR)
function calcMargemLiquida(custo: number, preco: number, despPct: number): number {
  if (preco <= 0 || custo <= 0) return 0
  const margemBruta = ((preco - custo) / preco) * 100  // % sobre PV
  return margemBruta - despPct                          // desconta despesas % sobre PV
}

// Lucro real por unidade em R$:
// PV × despesas% = despesas em R$ sobre o preço
// Lucro = PV − Custo − (PV × despesas%)
function calcLucroPorUnidade(custo: number, preco: number, despPct: number): number {
  if (preco <= 0 || custo <= 0) return 0
  const despesasR = preco * (despPct / 100)
  return preco - custo - despesasR
}

function calcFairProduct(raw: Omit<FairProduct,'desconto'|'margemMin'|'margemFeirado'|'precoMinimo'|'lucroPorUnid'|'receitaTotal'|'lucroTotal'|'status'>, cfg: FairConfig): FairProduct {
  const despPct      = cfg.icms + cfg.pisCofins + cfg.despesasFixas
  const precoMin     = calcPrecoMinimo(raw.custo, cfg)
  const desconto     = raw.precoNormal > 0 ? ((raw.precoNormal - raw.precoFeirado) / raw.precoNormal) * 100 : 0

  // FIX 1: margem líquida correta (base sobre PV, não híbrida)
  const margemFei    = calcMargemLiquida(raw.custo, raw.precoFeirado, despPct)
  const margemMin    = calcMargemLiquida(raw.custo, precoMin, despPct)

  // FIX 2: lucro por unidade = PV − custo − despesas em R$ (não PV × margem%)
  const lucroPorUnid = calcLucroPorUnidade(raw.custo, raw.precoFeirado, despPct)
  const receitaTotal = raw.precoFeirado * raw.qtdEstimada
  const lucroTotal   = lucroPorUnid * raw.qtdEstimada

  const status: FairProduct['status'] = margemFei >= cfg.lucroMinimo ? 'lucro' : margemFei >= 0 ? 'breakeven' : 'prejuizo'

  return {
    ...raw, desconto, margemFeirado: margemFei, margemMin,
    precoMinimo: precoMin, lucroPorUnid, receitaTotal, lucroTotal, status,
  }
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color = 'var(--accent)', children, defaultOpen = true }: {
  title: string; icon: React.ElementType; color?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom:'.75rem', overflow:'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', textAlign:'left', borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div style={{ width:28, height:28, borderRadius:7, background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', flex:1 }}>{title}</span>
        {open ? <ChevronUp size={14} style={{ color:'var(--text-secondary)' }} /> : <ChevronDown size={14} style={{ color:'var(--text-secondary)' }} />}
      </button>
      {open && <div style={{ padding:'1rem 1.1rem' }}>{children}</div>}
    </div>
  )
}

function Field({ label, value, onChange, suffix, type = 'number', placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void
  suffix?: string; type?: string; placeholder?: string
}) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>{label}</span>
      <div style={{ position:'relative' }}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          style={{ width:'100%', paddingRight: suffix ? 28 : 10, fontFamily: type==='number' ? "'IBM Plex Mono'" : 'inherit', fontSize:12 }}
        />
        {suffix && <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--text-tertiary)', pointerEvents:'none' }}>{suffix}</span>}
      </div>
    </label>
  )
}

// ── AI Strategy Panel ─────────────────────────────────────────────────────────
function AIStrategies({ fairConfig, products, kits, summary }: {
  fairConfig: FairConfig
  products:   FairProduct[]
  kits:       Kit[]
  summary:    { receita: number; lucro: number; breakeven: number }
}) {
  const configured   = getConfiguredProviders()
  const [provider,   setProvider]   = useState(configured[0]?.id ?? 'gemini')
  const [strategies, setStrategies] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const generate = useCallback(async () => {
    if (!configured.length) return
    setLoading(true); setError(null)

    const prodList = products.slice(0,10).map((p) =>
      `${p.nome}: normal R$${p.precoNormal.toFixed(2)} → feirão R$${p.precoFeirado.toFixed(2)} (${p.desconto.toFixed(1)}% off, margem ${p.margemFeirado.toFixed(1)}%)`
    ).join('\n')
    const kitList = kits.map((k) =>
      `Kit "${k.nome}": ${k.produtos.map(p=>p.nome).join(' + ')} por R$${k.precoKit.toFixed(2)} (${k.desconto.toFixed(1)}% off, margem ${k.margemKit.toFixed(1)}%)`
    ).join('\n')

    const prompt = `Você é especialista em planejamento de eventos de vendas (feirões) de móveis e eletrodomésticos no Brasil.

DADOS DO FEIRÃO:
Nome: ${fairConfig.nome || 'Feirão LARBRAS'}
Meta de receita: ${formatCurrency(fairConfig.metaReceita)}
Custo do evento: ${formatCurrency(fairConfig.aluguelLocal + fairConfig.marketing + fairConfig.pessoal + fairConfig.logistica + fairConfig.outros)}
Ponto de equilíbrio: ${formatCurrency(summary.breakeven)}
Projeção de receita: ${formatCurrency(summary.receita)}
Projeção de lucro líquido: ${formatCurrency(summary.lucro)}

PRODUTOS NO FEIRÃO:
${prodList || 'Nenhum produto cadastrado ainda'}

KITS MONTADOS:
${kitList || 'Nenhum kit montado ainda'}

Gere um plano estratégico detalhado para maximizar vendas e lucro. Responda em português brasileiro em formato de texto estruturado (não JSON), com seções:

## 1. ANÁLISE DO PLANEJAMENTO ATUAL
## 2. ESTRATÉGIAS DE VENDAS E ABORDAGEM
## 3. MONTAGEM DE KITS RECOMENDADOS
## 4. TÉCNICAS DE PRECIFICAÇÃO PSICOLÓGICA
## 5. AÇÕES PRÉ-FEIRÃO (marketing e captação)
## 6. AÇÕES DURANTE O FEIRÃO
## 7. ALERTAS E PONTOS DE ATENÇÃO

Seja específico, use os dados reais fornecidos, e foque no contexto de Manaus/AM.`

    try {
      const text = await callAIText(provider as never, prompt)
      setStrategies(text.replace(/```/g, '').trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [configured, provider, fairConfig, products, kits, summary])

  const curr = PROVIDERS.find((p) => p.id === provider)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ fontSize:11, color:'var(--text-secondary)', flex:1 }}>
          Estratégias geradas com base nos seus dados reais de planejamento
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {configured.length > 0 && (
            <select value={provider} onChange={(e) => setProvider(e.target.value as import('@/services/aiProviders').AIProvider)}
              className="select-field" style={{ fontSize:11, minWidth:110 }}>
              {configured.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}
          <button onClick={generate} disabled={loading || !configured.length}
            style={{ background: loading||!configured.length ? 'var(--bg-card2)' : (curr?.color ?? 'var(--accent)'), border:'none', color: loading||!configured.length ? 'var(--text-tertiary)' : '#0b0d18', borderRadius:8, padding:'7px 16px', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor: loading||!configured.length ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            {loading ? <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
            {loading ? 'Gerando…' : strategies ? 'Reanalisar' : 'Gerar Estratégias'}
          </button>
        </div>
      </div>

      {!configured.length && (
        <div style={{ padding:'1rem', background:'rgba(245,166,35,.08)', border:'1px solid rgba(245,166,35,.2)', borderRadius:8, fontSize:12, color:'var(--warning)' }}>
          Configure uma chave de API no .env.local (Gemini, Groq ou Claude) para gerar estratégias automaticamente.
        </div>
      )}

      {error && <div style={{ padding:'10px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.2)', borderRadius:8, color:'var(--danger)', fontSize:11 }}>{error}</div>}

      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[95,80,90,70,85].map((w,i) => (
            <div key={i} style={{ height:10, background:'var(--bg-card2)', borderRadius:4, width:`${w}%` }} />
          ))}
        </div>
      )}

      {!loading && strategies && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          {strategies.split('##').filter(Boolean).map((section, i) => {
            const lines  = section.trim().split('\n')
            const title  = lines[0].trim()
            const body   = lines.slice(1).join('\n').trim()
            const colors = [COLORS[i % COLORS.length]]
            return (
              <div key={i} style={{ marginBottom:14, padding:'12px 14px', background:`${colors[0]}08`, border:`1px solid ${colors[0]}25`, borderRadius:10, borderLeft:`3px solid ${colors[0]}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:colors[0], marginBottom:8 }}>{title}</div>
                <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{body}</div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !strategies && !error && configured.length > 0 && (
        <div style={{ padding:'2rem', textAlign:'center', background:'var(--bg-card2)', borderRadius:8, border:'1px dashed var(--border-subtle)' }}>
          <Sparkles size={24} style={{ color:'var(--text-tertiary)', display:'block', margin:'0 auto 10px' }} />
          <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Clique em <strong style={{ color:curr?.color }}>Gerar Estratégias</strong> para obter um plano completo baseado nos seus dados</div>
        </div>
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportFeirao(cfg: FairConfig, products: FairProduct[], kits: Kit[], summary: { receita:number; lucro:number; breakeven:number; despesasEvento:number }) {
  const name = cfg.nome || 'Feirão LARBRAS'

  // Excel
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map((p) => ({
    'Produto': p.nome, 'Marca': p.marca, 'Custo': p.custo,
    'Preço Normal': p.precoNormal, 'Preço Feirão': p.precoFeirado,
    'Desconto %': parseFloat(p.desconto.toFixed(2)),
    'Preço Mínimo': parseFloat(p.precoMinimo.toFixed(2)),
    'Margem %': parseFloat(p.margemFeirado.toFixed(2)),
    'Qtd Estimada': p.qtdEstimada,
    'Receita Estimada': parseFloat(p.receitaTotal.toFixed(2)),
    'Lucro Estimado': parseFloat(p.lucroTotal.toFixed(2)),
    'Status': p.status,
  }))), 'Produtos')

  if (kits.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kits.map((k) => ({
      'Kit': k.nome, 'Produtos': k.produtos.map(p=>p.nome).join(' + '),
      'Preço Kit': k.precoKit, 'Desconto Kit %': parseFloat(k.desconto.toFixed(2)),
      'Margem %': parseFloat(k.margemKit.toFixed(2)),
      'Lucro/Kit': parseFloat(k.lucroPorKit.toFixed(2)),
      'Qtd Estimada': k.qtdEstimada,
    }))), 'Kits')
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { 'Métrica': 'Receita Estimada',       'Valor': formatCurrency(summary.receita) },
    { 'Métrica': 'Despesas do Evento',     'Valor': formatCurrency(summary.despesasEvento) },
    { 'Métrica': 'Lucro Estimado',         'Valor': formatCurrency(summary.lucro) },
    { 'Métrica': 'Ponto de Equilíbrio',    'Valor': formatCurrency(summary.breakeven) },
    { 'Métrica': 'Meta de Receita',        'Valor': formatCurrency(cfg.metaReceita) },
  ]), 'Resumo')

  XLSX.writeFile(wb, `Feirao_${name.replace(/\s/g,'_')}_${format(new Date(),'yyyy-MM-dd')}.xlsx`)
}

// ── Main Component ────────────────────────────────────────────────────────────
const DEFAULT_CFG: FairConfig = {
  nome:'', data:'', local:'', metaReceita:50000,
  aluguelLocal:0, marketing:500, pessoal:800, logistica:300, outros:0,
  icms:12, pisCofins:0, despesasFixas:5, lucroMinimo:8,
}

export function FeiraoPlanner() {
  const { allRows, derived }    = useDashboardStore()
  const [cfg,      setCfg]      = useState<FairConfig>(DEFAULT_CFG)
  const [products, setProducts] = useState<FairProduct[]>([])
  const [kits,     setKits]     = useState<Kit[]>([])
  const [addKitOpen, setKitOpen] = useState(false)
  const [newKit,   setNewKit]   = useState<{ nome:string; items:{id:string;qty:number}[] }>({ nome:'', items:[] })

  const setCfgField = (k: keyof FairConfig, v: string | number) =>
    setCfg((prev) => ({ ...prev, [k]: typeof prev[k]==='number' ? parseFloat(String(v))||0 : v }))

  // Auto-recalculate products when cfg changes
  const recalcAll = useCallback((list: FairProduct[], newCfg: FairConfig) =>
    list.map((p) => calcFairProduct(p, newCfg)), [])

  const handleCfgChange = (k: keyof FairConfig, v: string | number) => {
    const newCfg = { ...cfg, [k]: typeof cfg[k]==='number' ? parseFloat(String(v))||0 : v }
    setCfg(newCfg)
    setProducts((prev) => recalcAll(prev, newCfg))
  }

  // Add product from sales data
  const addFromSales = (sp: { name: string; total: number; orders: number }) => {
    const precoNormal = sp.total / sp.orders
    const raw = {
      id:          sp.name + Date.now(),
      nome:        sp.name,
      marca:       allRows.find((r) => r._produto === sp.name)?._marca ?? '',
      custo:       0,
      precoNormal,
      precoFeirado: precoNormal * 0.9,  // default 10% off
      qtdEstimada: Math.max(1, sp.orders),
    }
    setProducts((prev) => [...prev, calcFairProduct(raw, cfg)])
  }

  const addManual = () => {
    const raw = { id:'manual_'+Date.now(), nome:'Novo Produto', marca:'', custo:0, precoNormal:0, precoFeirado:0, qtdEstimada:1 }
    setProducts((prev) => [...prev, calcFairProduct(raw, cfg)])
  }

  const updateProduct = (id: string, field: string, val: number | string) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p
      const updated = { ...p, [field]: typeof val === 'string' ? val : val }
      return calcFairProduct(updated as never, cfg)
    }))
  }

  const removeProduct = (id: string) => setProducts((prev) => prev.filter((p) => p.id !== id))

  // Kits
  const addKit = () => {
    if (!newKit.nome || !newKit.items.length) return
    const kitProds = newKit.items.map((item) => {
      const p = products.find((x) => x.id === item.id)
      return p ? { productId:p.id, nome:p.nome, qty:item.qty, custo:p.custo, precoFeirado:p.precoFeirado } : null
    }).filter(Boolean) as Kit['produtos']

    const custoTotal    = kitProds.reduce((s,p) => s + p.custo * p.qty, 0)
    const somaIndividual = kitProds.reduce((s,p) => s + p.precoFeirado * p.qty, 0)
    const precoKit      = somaIndividual * 0.95  // default 5% bundle discount
    const despPct       = cfg.icms + cfg.pisCofins + cfg.despesasFixas
    // FIX 4: margem e lucro do kit usando a mesma fórmula consistente dos produtos
    // margemKit = ((PV − custo) / PV × 100) − despesas%  (base sobre PV)
    // lucroPorKit = PV − custo − (PV × despesas%)        (R$ real)
    const margemKit     = precoKit > 0 ? ((precoKit - custoTotal) / precoKit * 100) - despPct : 0
    const lucroPorKit   = precoKit > 0 ? precoKit - custoTotal - precoKit * (despPct / 100) : 0

    const kit: Kit = {
      id:          'kit_'+Date.now(),
      nome:        newKit.nome,
      produtos:    kitProds,
      precoKit,
      desconto:    somaIndividual > 0 ? ((somaIndividual - precoKit) / somaIndividual) * 100 : 0,
      custoTotal,
      margemKit,
      lucroPorKit,
      qtdEstimada: 1,
    }
    setKits((prev) => [...prev, kit])
    setNewKit({ nome:'', items:[] })
    setKitOpen(false)
  }

  const updateKit = (id: string, field: string, val: number) => {
    setKits((prev) => prev.map((k) => {
      if (k.id !== id) return k
      const updated = { ...k, [field]: val }
      const somaInd  = k.produtos.reduce((s,p) => s+p.precoFeirado*p.qty, 0)
      const despPct  = cfg.icms + cfg.pisCofins + cfg.despesasFixas
      if (field === 'precoKit') {
        updated.desconto    = somaInd > 0 ? ((somaInd - val) / somaInd) * 100 : 0
        // FIX 4: consistent formula — lucro = PV − custo − (PV × despesas%)
        updated.margemKit   = val > 0 ? ((val - k.custoTotal) / val * 100) - despPct : 0
        updated.lucroPorKit = val > 0 ? val - k.custoTotal - val * (despPct / 100) : 0
      }
      return updated
    }))
  }

  // Summary
  const despesasEvento = cfg.aluguelLocal + cfg.marketing + cfg.pessoal + cfg.logistica + cfg.outros
  const summary = useMemo(() => {
    const receitaProd    = products.reduce((s,p) => s + p.receitaTotal, 0)
    const receitaKits    = kits.reduce((s,k) => s + k.precoKit * k.qtdEstimada, 0)
    const receita        = receitaProd + receitaKits

    // Lucro operacional = soma dos lucros reais (PV − custo − despesas%)
    const lucroProd      = products.reduce((s,p) => s + p.lucroTotal, 0)
    const lucroKits      = kits.reduce((s,k) => s + k.lucroPorKit * k.qtdEstimada, 0)
    const lucroOperacional = lucroProd + lucroKits
    const lucro          = lucroOperacional - despesasEvento

    // FIX 3: margem ponderada por receita (não média simples)
    // Cada produto tem peso proporcional à sua receita estimada
    // margemPonderada = Σ(lucro_i) / Σ(receita_i) × 100
    const avgMargemPct   = receita > 0 ? (lucroOperacional / receita) * 100 : 0

    // Ponto de equilíbrio com margem ponderada:
    // Precisamos vender "breakeven" em receita para que
    // lucro_operacional(breakeven) = despesasEvento
    // breakeven = despesasEvento ÷ (margemPonderada / 100)
    const breakeven      = avgMargemPct > 0 ? despesasEvento / (avgMargemPct / 100) : 0

    return { receita, lucro, lucroOperacional, breakeven, despesasEvento, avgMargemPct }
  }, [products, kits, despesasEvento])

  const metaPct = cfg.metaReceita > 0 ? (summary.receita / cfg.metaReceita) * 100 : 0

  // Product picker for kits
  const availableProducts = derived?.byProduto ?? []

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
            <Tag size={16} style={{ color:'var(--accent)' }} />
            Planejador de Feirão
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
            Planejamento completo: preços, kits, despesas, equilíbrio e estratégias
          </div>
        </div>
        {(products.length > 0 || kits.length > 0) && (
          <button onClick={() => exportFeirao(cfg, products, kits, summary)}
            style={{ background:'var(--bg-card2)', border:'1px solid var(--border-default)', color:'var(--text-primary)', borderRadius:8, padding:'7px 14px', fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <Download size={13} /> Exportar Planejamento
          </button>
        )}
      </div>

      {/* 1. Event Config */}
      <Section title="1. Dados do Evento" icon={Tag} color="#f5a623">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10 }}>
          <Field label="Nome do Feirão" value={cfg.nome} onChange={(v) => setCfgField('nome',v)} type="text" placeholder="Ex: 1º Feirão LARBRAS" />
          <Field label="Data" value={cfg.data} onChange={(v) => setCfgField('data',v)} type="date" />
          <Field label="Local/Endereço" value={cfg.local} onChange={(v) => setCfgField('local',v)} type="text" placeholder="Ex: Pavilhão da Amazônia" />
          <Field label="Meta de Receita" value={cfg.metaReceita} onChange={(v) => setCfgField('metaReceita',v)} suffix="R$" />
        </div>
      </Section>

      {/* 2. Event Costs */}
      <Section title="2. Despesas do Evento" icon={DollarSign} color="#f06b6b">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:12 }}>
          <Field label="Aluguel do Local"    value={cfg.aluguelLocal} onChange={(v) => handleCfgChange('aluguelLocal',v)}   suffix="R$" />
          <Field label="Marketing/Divulg."   value={cfg.marketing}    onChange={(v) => handleCfgChange('marketing',v)}      suffix="R$" />
          <Field label="Pessoal Extra"       value={cfg.pessoal}      onChange={(v) => handleCfgChange('pessoal',v)}        suffix="R$" />
          <Field label="Logística/Montagem"  value={cfg.logistica}    onChange={(v) => handleCfgChange('logistica',v)}      suffix="R$" />
          <Field label="Outros"              value={cfg.outros}       onChange={(v) => handleCfgChange('outros',v)}         suffix="R$" />
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.2)', borderRadius:8, display:'flex', gap:20, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:9, color:'var(--text-secondary)', marginBottom:2 }}>Total do Evento</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f06b6b', fontFamily:"'IBM Plex Mono'" }}>{formatCurrency(despesasEvento)}</div>
          </div>
          <div style={{ borderLeft:'1px solid var(--border-subtle)', paddingLeft:16 }}>
            <div style={{ fontSize:9, color:'var(--text-secondary)', marginBottom:2 }}>Ponto de Equilíbrio</div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--warning)', fontFamily:"'IBM Plex Mono'" }}>{summary.breakeven > 0 ? formatCurrency(summary.breakeven) : '—'}</div>
            <div style={{ fontSize:9, color:'var(--text-secondary)' }}>Receita mínima para cobrir as despesas do evento</div>
          </div>
        </div>

        {/* Expense breakdown bar */}
        {despesasEvento > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:9, color:'var(--text-secondary)', marginBottom:5 }}>Composição das despesas</div>
            <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', gap:1 }}>
              {[
                { v:cfg.aluguelLocal, c:'#f06b6b', l:'Aluguel' },
                { v:cfg.marketing,    c:'#fb923c', l:'Marketing' },
                { v:cfg.pessoal,      c:'#f5a623', l:'Pessoal' },
                { v:cfg.logistica,    c:'#22d3a0', l:'Logística' },
                { v:cfg.outros,       c:'#5b8dee', l:'Outros' },
              ].filter((x) => x.v > 0).map((item) => (
                <div key={item.l} title={`${item.l}: ${formatCurrency(item.v)}`}
                  style={{ flex:item.v, background:item.c, transition:'flex .3s' }} />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* 3. Pricing params */}
      <Section title="3. Parâmetros de Precificação para o Feirão" icon={Calculator} color="#5b8dee">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:10 }}>
          <Field label="ICMS %"           value={cfg.icms}          onChange={(v) => handleCfgChange('icms',v)}          suffix="%" />
          <Field label="PIS/COFINS %"     value={cfg.pisCofins}     onChange={(v) => handleCfgChange('pisCofins',v)}     suffix="%" />
          <Field label="Desp. Fixas %"    value={cfg.despesasFixas} onChange={(v) => handleCfgChange('despesasFixas',v)} suffix="%" />
          <Field label="Lucro Mínimo %"   value={cfg.lucroMinimo}   onChange={(v) => handleCfgChange('lucroMinimo',v)}   suffix="%" />
        </div>
        <div style={{ padding:'8px 12px', background:'rgba(91,141,238,.08)', border:'1px solid rgba(91,141,238,.2)', borderRadius:7, fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6 }}>
          <Info size={12} style={{ color:'var(--info)', flexShrink:0 }} />
          No feirão, reduza comissão (venda direta) e aceite lucro mínimo menor. O sistema calcula automaticamente o preço mínimo que você pode oferecer sem prejuízo.
        </div>
      </Section>

      {/* 4. Products */}
      <Section title={`4. Produtos do Feirão (${products.length})`} icon={Package} color="#22d3a0">
        {/* Add product buttons */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <button onClick={addManual}
            style={{ background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'6px 12px', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
            <Plus size={12} /> Adicionar manualmente
          </button>

          {/* From sales dropdown */}
          {availableProducts.length > 0 && (
            <div style={{ position:'relative' }}>
              <select
                onChange={(e) => { if (e.target.value) { const p = availableProducts.find((x) => x.name === e.target.value); if (p) addFromSales(p); e.target.value=''; } }}
                className="select-field"
                defaultValue=""
                style={{ minWidth:200, fontSize:11 }}>
                <option value="">+ Importar das vendas…</option>
                {availableProducts.filter((p) => !products.find((x) => x.nome===p.name)).slice(0,50).map((p) => (
                  <option key={p.name} value={p.name}>{p.name.slice(0,45)} — tk {formatCurrency(p.total/p.orders)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {products.length === 0 ? (
          <div style={{ padding:'2rem', textAlign:'center', background:'var(--bg-card2)', borderRadius:8, border:'1px dashed var(--border-subtle)', color:'var(--text-secondary)', fontSize:12 }}>
            Nenhum produto adicionado. Use os botões acima para começar.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:900 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                  {['Produto','Custo (R$)','Preço Normal','Preço Feirão','Desconto','Preço Mínimo','Margem %','Qtd Est.','Receita Est.','Lucro Est.','Status',''].map((h,i) => (
                    <th key={i} style={{ padding:'6px 10px', textAlign: i > 1 ? 'right' : 'left', fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const statusColor = p.status==='lucro' ? '#22d3a0' : p.status==='breakeven' ? '#f5a623' : '#f06b6b'
                  const abaixoMin   = p.precoFeirado > 0 && p.precoFeirado < p.precoMinimo
                  return (
                    <tr key={p.id} style={{ borderBottom:'1px solid var(--border-subtle)', background: abaixoMin ? 'rgba(240,107,107,.04)' : 'transparent' }}>
                      <td style={{ padding:'5px 10px', maxWidth:180 }}>
                        <input value={p.nome} onChange={(e) => updateProduct(p.id,'nome',e.target.value)}
                          style={{ background:'transparent', border:'none', color:'var(--text-primary)', fontFamily:'inherit', fontSize:11, width:'100%', outline:'none', fontWeight:500 }} />
                      </td>
                      {['custo','precoNormal','precoFeirado'].map((field) => (
                        <td key={field} style={{ padding:'4px 6px', textAlign:'right' }}>
                          <input type="number" min={0} step={0.01}
                            value={(p as never)[field] || ''}
                            placeholder="0,00"
                            onChange={(e) => updateProduct(p.id, field, parseFloat(e.target.value)||0)}
                            style={{ width:90, background:'var(--bg-card2)', border:`1px solid ${field==='precoFeirado' && abaixoMin ? '#f06b6b' : 'var(--border-subtle)'}`, color:'var(--text-primary)', borderRadius:5, padding:'3px 7px', fontFamily:"'IBM Plex Mono'", fontSize:10, textAlign:'right', outline:'none' }}
                          />
                        </td>
                      ))}
                      <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:10, color: p.desconto > 30 ? '#f06b6b' : 'var(--text-secondary)' }}>
                        {p.custo > 0 || p.precoNormal > 0 ? p.desconto.toFixed(1)+'%' : '—'}
                      </td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:10, color:'#f5a623' }}>
                        {p.custo > 0 ? formatCurrency(p.precoMinimo) : '—'}
                      </td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:10, color: statusColor, fontWeight:700 }}>
                        {p.custo > 0 && p.precoFeirado > 0 ? p.margemFeirado.toFixed(1)+'%' : '—'}
                      </td>
                      <td style={{ padding:'4px 6px', textAlign:'right' }}>
                        <input type="number" min={1} value={p.qtdEstimada}
                          onChange={(e) => updateProduct(p.id,'qtdEstimada',parseInt(e.target.value)||1)}
                          style={{ width:55, background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', borderRadius:5, padding:'3px 6px', fontFamily:"'IBM Plex Mono'", fontSize:10, textAlign:'right', outline:'none' }}
                        />
                      </td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:10, color:'var(--accent)' }}>
                        {p.receitaTotal > 0 ? formatCurrency(p.receitaTotal) : '—'}
                      </td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:10, color: p.lucroTotal >= 0 ? '#22d3a0' : '#f06b6b', fontWeight:600 }}>
                        {p.custo > 0 && p.precoFeirado > 0 ? formatCurrency(p.lucroTotal) : '—'}
                      </td>
                      <td style={{ padding:'5px 8px', textAlign:'center' }}>
                        {p.custo > 0 && p.precoFeirado > 0 && (
                          <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:4, background:`${statusColor}15`, color:statusColor, whiteSpace:'nowrap' }}>
                            {abaixoMin ? '⚠ Abaixo do mín.' : p.status==='lucro' ? '✓ Lucro' : p.status==='breakeven' ? '~ Equilíbrio' : '✗ Prejuízo'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'5px 6px' }}>
                        <button onClick={() => removeProduct(p.id)}
                          style={{ background:'none', border:'none', color:'var(--text-tertiary)', cursor:'pointer', padding:3, borderRadius:4, display:'flex' }}
                          onMouseOver={(e) => (e.currentTarget.style.color='var(--danger)')}
                          onMouseOut={(e)  => (e.currentTarget.style.color='var(--text-tertiary)')}
                        ><Trash2 size={11} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Discount guide */}
        {products.some((p) => p.custo > 0) && (
          <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(34,211,160,.06)', border:'1px solid rgba(34,211,160,.15)', borderRadius:8 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'#22d3a0', marginBottom:6 }}>
              Guia de Descontos Seguros (baseado na sua configuração)
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[5,10,15,20,25].map((disc) => {
                const despPctG = cfg.icms + cfg.pisCofins + cfg.despesasFixas
                // Nova margem real após desconto:
                // Se preço original = PV, novo preço = PV × (1 − disc/100)
                // Nova margem = ((PVnovo − custo) / PVnovo × 100) − despPct
                // Usando custo implícito: custo = PV × (1 − despPct/100 − lucroMin/100) com lucroMin atual
                // Simplificado: delta margem = −disc / (1 − disc/100)
                const novaMargem = (cfg.lucroMinimo - disc / (1 - disc/100)).toFixed(1)
                const ok = parseFloat(novaMargem) >= 0
                return (
                  <div key={disc} style={{ fontSize:10, color:'var(--text-secondary)' }}>
                    <strong style={{ color: ok ? '#22d3a0' : '#f06b6b' }}>{disc}% off</strong>
                    {' '}→ margem≈<strong style={{ color: ok ? '#22d3a0' : '#f06b6b', fontFamily:"'IBM Plex Mono'" }}>{novaMargem}%</strong>
                    {' '}<span style={{ fontSize:9, color:'var(--text-tertiary)' }}>{ok ? '✓' : '⚠ prejuízo'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* 5. Kits */}
      <Section title={`5. Kits e Combos (${kits.length})`} icon={Zap} color="#9b7bea">
        <div style={{ marginBottom:12 }}>
          <button onClick={() => setKitOpen(!addKitOpen)}
            style={{ background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'6px 12px', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom: addKitOpen ? 10 : 0 }}>
            <Plus size={12} /> Montar novo kit
          </button>

          {addKitOpen && (
            <div style={{ padding:'12px 14px', background:'var(--bg-card2)', borderRadius:10, border:'1px solid var(--border-default)', animation:'fadeIn .15s ease' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, marginBottom:10 }}>
                <input type="text" placeholder="Nome do kit (ex: Kit Sala de Jantar Completa)"
                  value={newKit.nome} onChange={(e) => setNewKit((prev) => ({ ...prev, nome:e.target.value }))}
                  className="input" style={{ fontSize:12 }} />
                <button onClick={addKit} disabled={!newKit.nome || !newKit.items.length}
                  style={{ background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'6px 16px', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor:'pointer', opacity: !newKit.nome||!newKit.items.length ? 0.5 : 1 }}>
                  Criar Kit
                </button>
              </div>
              <div style={{ fontSize:10, color:'var(--text-secondary)', marginBottom:8 }}>Selecione os produtos que compõem o kit:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {products.map((p) => {
                  const isIn = newKit.items.find((i) => i.id===p.id)
                  return (
                    <button key={p.id}
                      onClick={() => setNewKit((prev) => ({
                        ...prev,
                        items: isIn
                          ? prev.items.filter((i) => i.id !== p.id)
                          : [...prev.items, { id:p.id, qty:1 }]
                      }))}
                      style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${isIn ? '#9b7bea' : 'var(--border-subtle)'}`, background: isIn ? 'rgba(155,123,234,.15)' : 'transparent', color: isIn ? '#9b7bea' : 'var(--text-secondary)', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
                      {isIn ? '✓ ' : ''}{p.nome.slice(0,30)}
                    </button>
                  )
                })}
              </div>
              {products.length === 0 && <div style={{ fontSize:10, color:'var(--text-secondary)' }}>Adicione produtos primeiro (seção 4)</div>}
            </div>
          )}
        </div>

        {kits.length === 0 ? (
          <div style={{ padding:'2rem', textAlign:'center', background:'var(--bg-card2)', borderRadius:8, border:'1px dashed var(--border-subtle)', color:'var(--text-secondary)', fontSize:12 }}>
            Monte kits combinando produtos — ideal para aumentar ticket médio e dar percepção de desconto maior
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {kits.map((kit) => {
              const somaInd = kit.produtos.reduce((s,p) => s+p.precoFeirado*p.qty, 0)
              return (
                <div key={kit.id} style={{ padding:'12px 14px', background:'rgba(155,123,234,.06)', border:'1px solid rgba(155,123,234,.2)', borderRadius:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:3 }}>🎁 {kit.nome}</div>
                      <div style={{ fontSize:10, color:'var(--text-secondary)' }}>
                        {kit.produtos.map((p) => `${p.qty}x ${p.nome.slice(0,20)}`).join(' + ')}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--text-secondary)' }}>Soma individual</div>
                        <div style={{ fontSize:12, fontFamily:"'IBM Plex Mono'", color:'var(--text-secondary)', textDecoration:'line-through' }}>{formatCurrency(somaInd)}</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--text-secondary)', marginBottom:2 }}>Preço do Kit</div>
                        <input type="number" min={0} step={0.01} value={kit.precoKit.toFixed(2)}
                          onChange={(e) => updateKit(kit.id,'precoKit',parseFloat(e.target.value)||0)}
                          style={{ width:110, background:'var(--bg-card)', border:'1px solid rgba(155,123,234,.4)', color:'#9b7bea', borderRadius:6, padding:'4px 8px', fontFamily:"'IBM Plex Mono'", fontSize:13, fontWeight:700, textAlign:'center', outline:'none' }}
                        />
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--text-secondary)' }}>Desconto kit</div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#22d3a0', fontFamily:"'IBM Plex Mono'" }}>{kit.desconto.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--text-secondary)' }}>Margem</div>
                        <div style={{ fontSize:13, fontWeight:700, color: kit.margemKit >= 0 ? '#22d3a0' : '#f06b6b', fontFamily:"'IBM Plex Mono'" }}>{kit.margemKit.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--text-secondary)', marginBottom:2 }}>Qtd est.</div>
                        <input type="number" min={1} value={kit.qtdEstimada}
                          onChange={(e) => updateKit(kit.id,'qtdEstimada',parseInt(e.target.value)||1)}
                          style={{ width:55, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', borderRadius:5, padding:'4px 6px', fontFamily:"'IBM Plex Mono'", fontSize:11, textAlign:'center', outline:'none' }}
                        />
                      </div>
                      <button onClick={() => setKits((prev) => prev.filter((k) => k.id !== kit.id))}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-tertiary)', display:'flex', padding:4 }}
                        onMouseOver={(e) => (e.currentTarget.style.color='var(--danger)')}
                        onMouseOut={(e)  => (e.currentTarget.style.color='var(--text-tertiary)')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 6. Summary Dashboard */}
      <Section title="6. Resumo e Projeção Financeira" icon={TrendingUp} color="#22d3a0">
        {summary.receita === 0 ? (
          <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-secondary)', fontSize:12 }}>
            Adicione produtos com custo, preço e quantidade estimada para ver a projeção
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:'.75rem' }}>
              {[
                { label:'Receita Estimada',   value: summary.receita,          color:'var(--accent)',   icon: TrendingUp   },
                { label:'Despesas do Evento', value: summary.despesasEvento,   color:'#f06b6b',        icon: DollarSign   },
                { label:'Lucro Estimado',     value: summary.lucro,            color: summary.lucro>=0 ? '#22d3a0' : '#f06b6b', icon: Target },
                { label:'Ponto de Equilíbrio',value: summary.breakeven,        color:'var(--warning)', icon: AlertTriangle },
              ].map((kpi) => {
                const KpiIcon = kpi.icon
                return (
                  <div key={kpi.label} style={{ background:'var(--bg-card2)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <KpiIcon size={16} style={{ color:kpi.color, display:'block', margin:'0 auto 6px' }} />
                    <div style={{ fontSize:8, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:4 }}>{kpi.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:kpi.color, fontFamily:"'IBM Plex Mono'" }}>{formatCurrency(kpi.value)}</div>
                  </div>
                )
              })}
            </div>

            {/* Meta progress */}
            {cfg.metaReceita > 0 && (
              <div style={{ padding:'10px 14px', background:'var(--bg-card2)', borderRadius:8, marginBottom:'.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:10, color:'var(--text-primary)' }}>Progresso em relação à meta de {formatCurrency(cfg.metaReceita)}</span>
                  <span style={{ fontSize:11, fontWeight:700, color: metaPct >= 100 ? '#22d3a0' : 'var(--accent)', fontFamily:"'IBM Plex Mono'" }}>{metaPct.toFixed(1)}%</span>
                </div>
                <div style={{ height:8, background:'var(--bg-card)', borderRadius:4 }}>
                  <div style={{ width:`${Math.min(100,metaPct)}%`, height:'100%', background: metaPct>=100 ? '#22d3a0' : 'var(--accent)', borderRadius:4, transition:'width .8s' }} />
                </div>
              </div>
            )}

            {/* Charts */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
              {/* Revenue by product chart */}
              <div>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:8 }}>Receita por Produto</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={products.filter((p) => p.receitaTotal>0).sort((a,b) => b.receitaTotal-a.receitaTotal).slice(0,8)} margin={{ top:0, right:0, bottom:30, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" />
                    <XAxis dataKey="nome" tick={{ fill:'#94a8bf', fontSize:8 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0}
                      tickFormatter={(v) => v.slice(0,12)} />
                    <YAxis tickFormatter={(v) => formatCurrency(v).replace('R$\u00a0','R$')} tick={{ fill:'#94a8bf', fontSize:8, fontFamily:"'IBM Plex Mono'" }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip formatter={(val:number) => [formatCurrency(val),'Receita']} contentStyle={ttStyle} />
                    <Bar dataKey="receitaTotal" radius={[3,3,0,0]}>
                      {products.filter((p) => p.receitaTotal>0).sort((a,b) => b.receitaTotal-a.receitaTotal).slice(0,8).map((_,i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Profit composition pie */}
              <div>
                <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:8 }}>Composição Financeira</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name:'Custo dos Produtos', value: products.reduce((s,p) => s+p.custo*p.qtdEstimada,0) },
                        { name:'Despesas do Evento',  value: summary.despesasEvento },
                        { name:'Lucro',               value: Math.max(0, summary.lucro) },
                      ].filter((d) => d.value > 0)}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      strokeWidth={2} stroke="#161929"
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {['#f06b6b','#fb923c','#22d3a0'].map((color, i) => (
                        <Cell key={i} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val:number) => formatCurrency(val)} contentStyle={ttStyle} />
                    <Legend iconType="square" iconSize={8} formatter={(v) => <span style={{ fontSize:9, color:'#94a8bf' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alerts */}
            {products.some((p) => p.status==='prejuizo') && (
              <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.25)', borderRadius:8, display:'flex', alignItems:'flex-start', gap:8 }}>
                <AlertTriangle size={14} style={{ color:'#f06b6b', flexShrink:0, marginTop:1 }} />
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f06b6b', marginBottom:3 }}>Produtos em prejuízo detectados:</div>
                  <div style={{ fontSize:10, color:'var(--text-secondary)' }}>
                    {products.filter((p) => p.status==='prejuizo').map((p) => p.nome.slice(0,30)).join(', ')}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:3 }}>Ajuste o preço acima do mínimo calculado ou remova o produto do feirão.</div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* 7. AI Strategies */}
      <Section title="7. Estratégias com IA" icon={Sparkles} color="#9b7bea">
        <AIStrategies fairConfig={cfg} products={products} kits={kits} summary={summary} />
      </Section>
    </div>
  )
}
