// ============================================================
// MÓDULO 8 — Insights IA  (v6 — all fixes)
// ============================================================

import { useState, useCallback } from 'react'
import {
  Sparkles, RefreshCw, TrendingUp, AlertTriangle,
  Lightbulb, BarChart2, Key, ChevronDown, X, Zap,
} from 'lucide-react'
import { useDashboardStore }  from '@/store/useDashboardStore'
import { formatCurrency }     from '@/services/analytics'
import {
  PROVIDERS, callAI, getConfiguredProviders, isProviderConfigured,
  type AIProvider,
} from '@/services/aiProviders'

type InsightBlock = {
  category: 'destaque' | 'alerta' | 'oportunidade' | 'tendencia'
  title:    string
  body:     string
}
type AIResponse       = { resumo: string; insights: InsightBlock[] }
type Strategy         = { acao: string; prazo: string; impacto: string }
type StrategyResponse = { estrategias: Strategy[] }

const META = {
  destaque:    { icon: TrendingUp,    color: '#22d3a0', bg: 'rgba(34,211,160,.08)',  border: 'rgba(34,211,160,.25)',  label: 'Destaque'     },
  alerta:      { icon: AlertTriangle, color: '#f06b6b', bg: 'rgba(240,107,107,.08)', border: 'rgba(240,107,107,.25)', label: 'Alerta'       },
  oportunidade:{ icon: Lightbulb,     color: '#f5a623', bg: 'rgba(245,166,35,.08)',  border: 'rgba(245,166,35,.25)',  label: 'Oportunidade' },
  tendencia:   { icon: BarChart2,     color: '#5b8dee', bg: 'rgba(91,141,238,.08)',  border: 'rgba(91,141,238,.2)',   label: 'Tendência'    },
}

// Normalize category: handles accents, plurals, case from any AI model
function normCategory(raw: string): keyof typeof META {
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove accents: tendência → tendencia
    .replace(/s$/, '')                  // remove plural: oportunidades → oportunidade
    .trim()
  if (s in META) return s as keyof typeof META
  // Fuzzy fallback
  if (s.includes('dest')) return 'destaque'
  if (s.includes('alert') || s.includes('risco')) return 'alerta'
  if (s.includes('opor')) return 'oportunidade'
  return 'tendencia'
}

// ── Strategy Detail Modal ─────────────────────────────────────────────────────
function StrategyModal({ insight, provider, onClose }: {
  insight: InsightBlock; provider: AIProvider; onClose: () => void
}) {
  const meta = META[normCategory(insight.category)]
  const Icon = meta.icon
  const curr = PROVIDERS.find((p) => p.id === provider)!

  const [strategies, setStrategies] = useState<Strategy[] | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [generated,  setGenerated]  = useState(false)

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    const prompt = `Você é consultor de varejo de móveis e eletrodomésticos no Brasil.
Com base no insight abaixo, gere 3 estratégias de melhoria práticas.

INSIGHT: ${insight.title}
CONTEXTO: ${insight.body}

REGRAS: Use termos BR (bairros/localidades, não "lojas"). Ações específicas e mensuráveis.
Prazos: curto (1-4sem), médio (1-3 meses), longo (3-6 meses).

Responda SOMENTE JSON puro sem markdown:
{"estrategias":[{"acao":"ação específica","prazo":"curto|médio|longo","impacto":"ex: +15% ticket médio"}]}`
    try {
      const text = await callAI(provider, prompt)
      const parsed: StrategyResponse = JSON.parse(text)
      setStrategies(parsed.estrategias ?? [])
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [insight, provider])

  const PRAZO_COLOR: Record<string, string> = { 'curto': '#22d3a0', 'médio': '#f5a623', 'longo': '#5b8dee', 'medio': '#f5a623' }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', backdropFilter:'blur(5px)', animation:'fadeIn .15s ease' }}
    >
      <div style={{ background:'var(--bg-modal)', border:`1px solid ${meta.border}`, borderRadius:16, width:'100%', maxWidth:520, boxShadow:`0 32px 80px rgba(0,0,0,.6)`, animation:'slideInRight .2s ease', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'1.1rem 1.25rem', background:meta.bg, borderBottom:`1px solid ${meta.border}`, display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:`${meta.color}20`, border:`1px solid ${meta.color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon size={16} style={{ color:meta.color }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.8px', color:meta.color, marginBottom:3 }}>{meta.label}</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.3 }}>{insight.title}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-tertiary)', cursor:'pointer', padding:4, borderRadius:6, display:'flex', flexShrink:0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', padding:'1.25rem', flex:1 }}>
          <p style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.75, margin:'0 0 1.25rem', padding:'10px 14px', background:'var(--bg-card2)', borderRadius:8, border:'1px solid var(--border-subtle)' }}>
            {insight.body}
          </p>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={13} style={{ color:curr.color }} />
              ESTRATÉGIAS DE MELHORIA
            </div>
            <button
              onClick={generate} disabled={loading}
              style={{ background: loading?'var(--bg-card2)':curr.color, border:'none', color: loading?'var(--text-tertiary)':'#0b0d18', borderRadius:7, padding:'5px 12px', fontFamily:'inherit', fontSize:11, fontWeight:700, cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:5 }}
            >
              {loading ? <RefreshCw size={11} style={{ animation:'spin 1s linear infinite' }} /> : <Zap size={11} />}
              {loading ? 'Gerando…' : generated ? 'Regerar' : 'Gerar estratégias'}
            </button>
          </div>

          {error && <div style={{ padding:'8px 12px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.2)', borderRadius:8, color:'var(--danger)', fontSize:11, marginBottom:10 }}>{error}</div>}

          {loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background:'var(--bg-card2)', borderRadius:8, padding:'12px 14px', height:72 }}>
                  {[60,80,40].map((w,j) => <div key={j} style={{ height:9, background:'var(--bg-card)', borderRadius:3, marginBottom:7, width:`${w}%` }} />)}
                </div>
              ))}
            </div>
          )}

          {!loading && strategies && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, animation:'fadeIn .3s ease' }}>
              {strategies.map((s, i) => {
                const pk = (s.prazo ?? 'médio').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                const pc = PRAZO_COLOR[pk] ?? '#5b8dee'
                return (
                  <div key={i} style={{ background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${pc}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', fontFamily:"'IBM Plex Mono'" }}>#{i+1}</span>
                      <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4, background:`${pc}15`, color:pc, textTransform:'uppercase', letterSpacing:'.6px' }}>Prazo {s.prazo}</span>
                      {s.impacto && <span style={{ fontSize:9, color:'#22d3a0', fontWeight:600, marginLeft:'auto' }}>{s.impacto}</span>}
                    </div>
                    <p style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.6, margin:0 }}>{s.acao}</p>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !strategies && !error && (
            <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-secondary)', fontSize:12, background:'var(--bg-card2)', borderRadius:8, border:'1px dashed var(--border-subtle)' }}>
              Clique em <strong style={{ color:curr.color }}>Gerar estratégias</strong> para obter recomendações de ação
            </div>
          )}
        </div>

        <div style={{ padding:'10px 1.25rem', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={{ width:'100%', background:'var(--bg-card2)', border:'1px solid var(--border-default)', color:'var(--text-secondary)', borderRadius:8, padding:'8px 0', fontFamily:'inherit', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            Fechar <X size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Provider Selector ─────────────────────────────────────────────────────────
function ProviderSelector({ value, onChange }: { value: AIProvider; onChange: (v: AIProvider) => void }) {
  const [open, setOpen] = useState(false)
  const curr = PROVIDERS.find((p) => p.id === value)!
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ background:'var(--bg-card2)', border:`1px solid ${curr.color}44`, color:'var(--text-primary)', borderRadius:8, padding:'6px 12px', fontFamily:'inherit', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:curr.color, flexShrink:0 }} />
        {curr.label}
        <span style={{ fontSize:9, color:'var(--text-secondary)' }}>{curr.description}</span>
        <ChevronDown size={10} style={{ color:'var(--text-tertiary)' }} />
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--bg-modal)', border:'1px solid var(--border-default)', borderRadius:10, overflow:'hidden', zIndex:400, minWidth:280, boxShadow:'var(--shadow-modal)', animation:'fadeIn .15s ease' }} onMouseLeave={() => setOpen(false)}>
          {PROVIDERS.map((p) => {
            const ok = isProviderConfigured(p.id)
            const active = p.id === value
            return (
              <button key={p.id} onClick={() => { if(ok){onChange(p.id);setOpen(false)} }}
                style={{ width:'100%', background: active?`${p.color}15`:'none', border:'none', padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor: ok?'pointer':'not-allowed', textAlign:'left', opacity: ok?1:0.45 }}
                onMouseOver={(e) => { if(ok) e.currentTarget.style.background=`${p.color}15` }}
                onMouseOut={(e) => { e.currentTarget.style.background = active?`${p.color}15`:'none' }}
              >
                <span style={{ width:10, height:10, borderRadius:'50%', background:p.color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{p.label}</div>
                  <div style={{ fontSize:10, color:'var(--text-secondary)' }}>{p.description}</div>
                </div>
                {!ok && <span style={{ fontSize:9, color:'var(--warning)', background:'rgba(251,146,60,.1)', padding:'2px 6px', borderRadius:4, fontWeight:600 }}>sem chave</span>}
                {active && ok && <span style={{ fontSize:9, color:p.color, fontWeight:700 }}>ativo</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Setup Card ────────────────────────────────────────────────────────────────
function SetupCard() {
  return (
    <div className="card" style={{ padding:'2rem 1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:38, height:38, borderRadius:10, background:'var(--accent-muted)', border:'1px solid rgba(245,166,35,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Key size={17} style={{ color:'var(--accent)' }} />
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Configurar provedor de IA</div>
          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Adicione pelo menos uma chave no .env.local</div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {PROVIDERS.map((p) => (
          <div key={p.id} style={{ background:'var(--bg-card2)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:p.color, flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{p.label} — {p.description}</div>
              <code style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", color:'var(--text-secondary)', background:'var(--bg-card)', padding:'1px 6px', borderRadius:4 }}>{p.envKey}=sua-chave</code>
            </div>
            <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:p.color, textDecoration:'none', fontWeight:600, whiteSpace:'nowrap' }}>Obter ↗</a>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AIInsights() {
  const { derived, filteredRows } = useDashboardStore()
  const configured      = getConfiguredProviders()
  const defaultProvider = configured[0]?.id ?? 'claude'

  const [provider,  setProvider]  = useState<AIProvider>(defaultProvider)
  const [response,  setResponse]  = useState<AIResponse | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const [selected,  setSelected]  = useState<InsightBlock | null>(null)

  const generate = useCallback(async () => {
    if (!derived) return
    setLoading(true); setError(null); setSelected(null)

    const dp = derived.byDate
    const fc = formatCurrency
    const top3v = (arr: {name:string;total:number;orders:number}[]) =>
      arr.slice(0,3).map((x,i) => `${i+1}.${x.name}:${fc(x.total)}/${x.orders}p/tk${fc(x.total/x.orders)}`).join(' | ')
    const top3s = (arr: {name:string;total:number}[]) =>
      arr.slice(0,3).map((x,i) => `${i+1}.${x.name}:${fc(x.total)}`).join(' | ')

    const prompt = `Analise dados de varejo móveis/eletrodomésticos Manaus/AM. Responda SOMENTE JSON puro.

DADOS REAIS:
FAT=${fc(derived.totalRevenue)} PED=${derived.totalOrders} CLI=${derived.uniqueClients??0} TK_PED=${fc(derived.avgTicket)} TK_CLI=${fc(derived.avgTicketPerClient??0)} UNID=${derived.totalQty} DIAS=${dp.length} MEDIA_DIA=${fc(dp.length?derived.totalRevenue/dp.length:0)}
VENDEDORES: ${top3v(derived.byVendedor)}
PRODUTOS: ${top3v(derived.byProduto)}
MARCAS: ${top3s(derived.byMarca)}
BAIRROS: ${top3s(derived.byBairro)}

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE os números acima, sem inventar valores
2. Escreva "bairros" ou "localidades", NUNCA "lojas" ou "stores"
3. Vendedores são pessoas físicas
4. category deve ser EXATAMENTE uma de: destaque, alerta, oportunidade, tendencia

JSON (6 insights, min 1 de cada category):
{"resumo":"2 frases com dados reais","insights":[{"category":"destaque","title":"max 6 palavras","body":"2 frases com números"},{"category":"alerta","title":"...","body":"..."},{"category":"oportunidade","title":"...","body":"..."},{"category":"tendencia","title":"...","body":"..."},{"category":"destaque","title":"...","body":"..."},{"category":"alerta","title":"...","body":"..."}]}`

    try {
      const text   = await callAI(provider, prompt)
      const raw: AIResponse = JSON.parse(text)
      // Normalize categories to prevent render crash
      const safe: AIResponse = {
        resumo: raw.resumo ?? '',
        insights: (raw.insights ?? []).map((ins) => ({
          ...ins,
          category: normCategory(ins.category as string),
        })),
      }
      setResponse(safe); setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [derived, provider])

  if (configured.length === 0) return <SetupCard />

  if (!derived || !filteredRows.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'5rem 2rem', gap:16 }}>
        <Sparkles size={32} style={{ color:'var(--accent)' }} />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Importe dados para gerar insights</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)' }}>O modelo analisa seus dados e gera recomendações estratégicas</div>
        </div>
      </div>
    )
  }

  const curr = PROVIDERS.find((p) => p.id === provider)!

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:7 }}>
            <Sparkles size={15} style={{ color:'var(--accent)' }} />
            Análise Inteligente de Vendas
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
            {filteredRows.length.toLocaleString('pt-BR')} registros · clique em um card para gerar estratégias
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ProviderSelector value={provider} onChange={(v) => { setProvider(v); setResponse(null); setError(null) }} />
          <button
            onClick={generate} disabled={loading}
            style={{ background: loading?'var(--bg-card2)':curr.color, border:`1px solid ${curr.color}`, color: loading?'var(--text-secondary)':'#0b0d18', borderRadius:8, padding:'7px 16px', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .15s' }}
          >
            {loading ? <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
            {loading ? 'Analisando…' : generated ? 'Reanalisar' : 'Gerar Insights'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding:'12px 16px', background:'rgba(240,107,107,.08)', border:'1px solid rgba(240,107,107,.25)', borderRadius:10, color:'var(--danger)', fontSize:12, marginBottom:'1rem', lineHeight:1.55 }}>
          <strong>Erro ({curr.label}):</strong> {error}
        </div>
      )}

      {loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'.75rem' }}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} className="card" style={{ padding:'1rem 1.1rem', height:120 }}>
              {[40,70,90,60].map((w,j) => <div key={j} style={{ height:j===1?14:10, background:'var(--bg-card2)', borderRadius:4, marginBottom:8, width:`${w}%`, opacity:1-j*.15 }} />)}
            </div>
          ))}
        </div>
      )}

      {!loading && response && (
        <div style={{ animation:'fadeIn .3s ease' }}>
          <div className="card" style={{ padding:'1rem 1.25rem', marginBottom:'.75rem', borderLeft:`3px solid ${curr.color}`, borderRadius:'0 12px 12px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:curr.color, flexShrink:0 }} />
              <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.8px', color:curr.color }}>
                Resumo Executivo · {curr.description}
              </span>
            </div>
            <p style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.65, margin:0 }}>{response.resumo}</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'.75rem' }}>
            {response.insights.map((insight, i) => {
              const meta = META[normCategory(insight.category)]
              const Icon = meta.icon
              return (
                <div
                  key={i}
                  onClick={() => setSelected(insight)}
                  className="card"
                  style={{ padding:'1rem 1.1rem', background:meta.bg, borderColor:meta.border, cursor:'pointer', animation:`fadeIn .3s ease ${i*.07}s both`, transition:'transform .15s, box-shadow .15s, border-color .15s' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${meta.color}25`; e.currentTarget.style.borderColor=meta.color+'55' }}
                  onMouseOut={(e)  => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor=meta.border }}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Icon size={13} style={{ color:meta.color, flexShrink:0 }} />
                      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:meta.color }}>{meta.label}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:meta.color, opacity:0.7, fontWeight:600 }}>
                      <Zap size={10} /> Estratégias
                    </div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:6, lineHeight:1.3 }}>{insight.title}</div>
                  <p style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.55, margin:'0 0 8px' }}>
                    {insight.body}
                  </p>
                  <div style={{ fontSize:9, color:meta.color, fontWeight:600, opacity:0.6, textAlign:'right' }}>
                    Clique para gerar estratégias →
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && !response && !error && (
        <div className="card" style={{ padding:'3rem 2rem', textAlign:'center' }}>
          <Sparkles size={28} style={{ color:'var(--text-tertiary)', display:'block', margin:'0 auto 12px' }} />
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6 }}>
            Clique em <strong style={{ color:curr.color }}>Gerar Insights</strong> para analisar
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.6 }}>
            Usando <strong>{curr.label}</strong> · Após gerar, clique em qualquer card para obter estratégias
          </div>
        </div>
      )}

      {selected && (
        <StrategyModal insight={selected} provider={provider} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
