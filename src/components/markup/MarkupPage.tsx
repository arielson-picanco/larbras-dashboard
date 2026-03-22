// ============================================================
// MÓDULO 11 — Precificação com Markup  (completo e robusto)
// ============================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'
import { useDashboardStore }   from '@/store/useDashboardStore'
import { formatCurrency }      from '@/services/analytics'
import { exportMarkupReport }  from './markupExport'
import {
  Calculator, Plus, Trash2, Download, Info,
  TrendingUp, AlertTriangle, CheckCircle2, Copy, RefreshCw,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CostLine {
  id:      string
  label:   string
  value:   number
  type:    'fixed' | 'percent'   // fixed = R$, percent = %
  base:    'custo' | 'venda'     // base de cálculo para %
}

interface PricingItem {
  id:              string
  produto:         string
  custo:           number
  precoVenda:      number   // preço praticado nas vendas
  precoSugerido:   number   // calculado pelo markup
  markup:          number   // % sobre o preço sugerido
  margem:          number   // % margem do preço sugerido
  margemPraticada: number   // % margem real do preço praticado
  abaixoDoCusto:   boolean  // true quando precoVenda < custo
  custoTotal:      number   // custo + todas as despesas
  despesas:        CostLine[]
  lucroDesejado:   number
  margemStatus:    'alto' | 'ok' | 'baixo' | 'prejuizo'
  statusPraticado: 'alto' | 'ok' | 'baixo' | 'prejuizo'
}

interface GlobalConfig {
  icms:       number
  pisCofins:  number
  comissao:   number
  frete:      number
  despesasFixas: number
  lucroDesejado: number
  regime:     'simples' | 'presumido' | 'real'
}

// ── Formulas ──────────────────────────────────────────────────────────────────
// Markup BR: Preço = Custo / (1 - (Despesas% + Lucro%))
function calcMarkup(custo: number, despesasPct: number, lucroPct: number): {
  precoVenda: number; markup: number; margem: number; markupDivisor: number
} {
  const fator     = 1 - (despesasPct + lucroPct) / 100
  if (fator <= 0) return { precoVenda: 0, markup: 0, margem: 0, markupDivisor: 0 }
  const pv        = custo / fator
  const markup    = ((pv - custo) / custo) * 100
  const margem    = ((pv - custo) / pv) * 100
  const divisor   = 100 / (100 - despesasPct - lucroPct)
  return { precoVenda: pv, markup, margem, markupDivisor: divisor }
}

// Status para margem SUGERIDA (base = lucroDesejado pois fórmula já embute despesas)
// A margem sugerida = despesas% + lucroDesejado%, então o "ok" é quando está próxima ao lucro meta
function calcMargemStatusSugerida(margemLiquida: number, lucroPct: number): PricingItem['margemStatus'] {
  if (margemLiquida < 0)              return 'prejuizo'
  if (margemLiquida < lucroPct * 0.9) return 'baixo'   // mais de 10% abaixo da meta
  if (margemLiquida > lucroPct * 1.1) return 'alto'    // mais de 10% acima da meta
  return 'ok'
}

// Status para margem PRATICADA (base = margem líquida real após descontar todas as despesas)
function calcMargemStatusPraticada(margemLiquida: number, lucroPct: number): PricingItem['margemStatus'] {
  if (margemLiquida < 0)              return 'prejuizo'
  if (margemLiquida < lucroPct * 0.5) return 'baixo'
  if (margemLiquida >= lucroPct * 1.2) return 'alto'
  return 'ok'
}

const STATUS_META = {
  alto:    { color: '#22d3a0', bg: 'rgba(34,211,160,.1)',  label: 'Margem alta',    icon: TrendingUp   },
  ok:      { color: '#5b8dee', bg: 'rgba(91,141,238,.1)',  label: 'Margem adequada',icon: CheckCircle2 },
  baixo:   { color: '#f5a623', bg: 'rgba(245,166,35,.1)',  label: 'Margem baixa',   icon: AlertTriangle},
  prejuizo:{ color: '#f06b6b', bg: 'rgba(240,107,107,.1)', label: 'Prejuízo',       icon: AlertTriangle},
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ttStyle = {
  background:'#161929', border:'1px solid rgba(91,141,238,.35)',
  borderRadius:10, padding:'10px 14px', fontSize:11, color:'#e2e8f0',
  boxShadow:'0 16px 40px rgba(0,0,0,.65)', fontFamily:"'DM Sans', system-ui",
}

// ── Tooltip popup — viewport-aware ───────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open,   setOpen]   = useState(false)
  const [align,  setAlign]  = useState<'center'|'left'|'right'>('center')
  const btnRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Compute horizontal alignment to keep tooltip inside viewport
  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const vpW  = window.innerWidth
    const boxW = 280
    // If centered tooltip would overflow left
    if (rect.left - boxW / 2 < 8)    { setAlign('left');   return }
    // If centered tooltip would overflow right
    if (rect.left + boxW / 2 > vpW - 8) { setAlign('right');  return }
    setAlign('center')
  }, [open])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        boxRef.current  && !boxRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const offsetX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%'
  const arrowLeft = align === 'left' ? 14 : align === 'right' ? 'calc(100% - 14px)' : '50%'

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center',
          color: open ? 'var(--accent)' : 'var(--text-tertiary)',
          transition: 'color .15s',
        }}
      >
        <Info size={11} />
      </button>

      {open && (
        <div
          ref={boxRef}
          style={{
            position:    'absolute',
            bottom:      'calc(100% + 8px)',
            left:        '50%',
            transform:   `translateX(${offsetX})`,
            zIndex:      700,
            background:  'var(--bg-modal)',
            border:      '1px solid var(--border-default)',
            borderRadius: 10,
            padding:     '12px 14px',
            width:       280,
            boxShadow:   '0 16px 40px rgba(0,0,0,.55)',
            animation:   'fadeIn .15s ease',
          }}
        >
          {/* Arrow */}
          <div style={{
            position:    'absolute',
            bottom:      -6,
            left:        arrowLeft,
            transform:   'translateX(-50%) rotate(45deg)',
            width:       10, height: 10,
            background:  'var(--bg-modal)',
            border:      '1px solid var(--border-default)',
            borderTop:   'none', borderLeft: 'none',
            zIndex:      -1,
          }} />
          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
            {text}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Reusable input ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, suffix, min = 0, step = 0.1, tooltip }: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; min?: number; step?: number; tooltip?: string
}) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:4 }}>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <div style={{ position:'relative' }}>
        <input
          type="number" min={min} step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, parseFloat(e.target.value) || 0))}
          className="input"
          style={{ width:'100%', paddingRight: suffix ? 28 : 10, fontFamily:"'IBM Plex Mono'", fontSize:12 }}
        />
        {suffix && (
          <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--text-tertiary)', pointerEvents:'none' }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

// ── Global Config Panel ───────────────────────────────────────────────────────
function GlobalConfigPanel({ config, onChange }: {
  config:   GlobalConfig
  onChange: (c: GlobalConfig) => void
}) {
  const set = (k: keyof GlobalConfig, v: number | string) =>
    onChange({ ...config, [k]: v })

  const totalDespesas = config.icms + config.pisCofins + config.comissao + config.frete + config.despesasFixas
  const fatorMarkup   = 100 / (100 - totalDespesas - config.lucroDesejado)

  return (
    <div className="card" style={{ padding:'1rem 1.1rem', marginBottom:'.75rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.875rem' }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>
          Configuração Global de Markup
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:9, color:'var(--text-tertiary)' }}>Regime:</span>
          {(['simples','presumido','real'] as const).map((r) => (
            <button key={r} onClick={() => {
              const pis = r === 'simples' ? 0 : r === 'presumido' ? 9.25 : 9.25
              onChange({ ...config, regime: r, pisCofins: pis })
            }}
              style={{ background: config.regime===r ? 'var(--accent-muted)' : 'transparent', border:`1px solid ${config.regime===r ? 'rgba(245,166,35,.4)' : 'var(--border-subtle)'}`, color: config.regime===r ? 'var(--accent)' : 'var(--text-secondary)', borderRadius:6, padding:'3px 8px', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
            >
              {r.charAt(0).toUpperCase()+r.slice(1)}
            </button>
          ))}
        </div>
        {config.regime === 'simples' && (
          <div style={{ fontSize:9, color:'var(--warning)', display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
            ⓘ Simples: PIS/COFINS já incluso no DAS — mantenha em 0%. Altere apenas se sua contabilidade calcular separado.
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:10 }}>
        <Field label="ICMS"          value={config.icms}          onChange={(v) => set('icms',v)}          suffix="%" step={0.5} tooltip="ICMS — Imposto sobre Circulação de Mercadorias e Serviços. Incide sobre o preço de venda. No AM a alíquota interna é geralmente 12%. Para produtos de fora do estado pode variar. Não é lucro: é repassado ao governo." />
        <Field label="PIS/COFINS"    value={config.pisCofins}     onChange={(v) => set('pisCofins',v)}     suffix="%" step={0.01} tooltip="PIS/COFINS — Contribuições federais sobre o faturamento. No Simples Nacional as alíquotas já estão embutidas no DAS (use 0%). No Lucro Presumido/Real use 9,25% (PIS 1,65% + COFINS 7,6%). Incide sobre o preço de venda." />
        <Field label="Comissão"      value={config.comissao}      onChange={(v) => set('comissao',v)}      suffix="%" step={0.5} tooltip="Comissão do Vendedor — Percentual pago ao vendedor sobre o valor da venda. Ex: 5% = para cada R$ 100 vendidos, R$ 5 vai para o vendedor. Reduz diretamente sua margem de lucro." />
        <Field label="Frete/Log."    value={config.frete}         onChange={(v) => set('frete',v)}         suffix="%" step={0.1} tooltip="Frete e Logística — Use este campo para a entrega ao cliente (% sobre preço de venda). O frete de COMPRA do fornecedor deve ser somado ao custo do produto antes de preencher o campo Custo. Ex: produto R$ 2.000 + frete de compra R$ 100 = custo R$ 2.100." />
        <Field label="Desp. Fixas"   value={config.despesasFixas} onChange={(v) => set('despesasFixas',v)} suffix="%" step={0.5} tooltip="Despesas Fixas — Custos operacionais mensais rateados por produto: aluguel, energia, internet, salários de administrativos, contador, etc. Calcule: total de despesas fixas ÷ receita mensal × 100." />
        <Field label="Lucro Desejado" value={config.lucroDesejado} onChange={(v) => set('lucroDesejado',v)} suffix="%" step={0.5} tooltip="Lucro Desejado — Percentual de lucro líquido sobre o preço de venda após pagar TODOS os custos (produto + impostos + comissão + frete + despesas fixas). Diferente de markup: margem de 20% ≠ markup de 20%." />
      </div>

      {/* Summary bar */}
      <div style={{ marginTop:12, padding:'10px 14px', background:'var(--bg-card2)', borderRadius:8, display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:9, color:'var(--text-tertiary)', marginBottom:2 }}>Total de despesas</div>
          <div style={{ fontSize:14, fontWeight:700, color: totalDespesas > 45 ? 'var(--danger)' : 'var(--text-primary)', fontFamily:"'IBM Plex Mono'" }}>
            {totalDespesas.toFixed(2)}%
          </div>
        </div>
        <div style={{ width:1, height:32, background:'var(--border-subtle)' }} />
        <div>
          <div style={{ fontSize:9, color:'var(--text-tertiary)', marginBottom:2 }}>Lucro desejado</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', fontFamily:"'IBM Plex Mono'" }}>
            {config.lucroDesejado.toFixed(2)}%
          </div>
        </div>
        <div style={{ width:1, height:32, background:'var(--border-subtle)' }} />
        <div>
          <div style={{ fontSize:9, color:'var(--text-tertiary)', marginBottom:2 }}>Markup divisor</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--success)', fontFamily:"'IBM Plex Mono'" }}>
            {fatorMarkup > 0 && fatorMarkup < 100 ? fatorMarkup.toFixed(4) : '—'}
          </div>
        </div>
        <div style={{ width:1, height:32, background:'var(--border-subtle)' }} />
        <div>
          <div style={{ fontSize:9, color:'var(--text-tertiary)', marginBottom:2 }}>Markup %</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--info)', fontFamily:"'IBM Plex Mono'" }}>
            {fatorMarkup > 0 && fatorMarkup < 100 ? ((fatorMarkup - 1) * 100).toFixed(2) + '%' : '—'}
          </div>
        </div>
        <div style={{ marginLeft:'auto', flex:1 }}>
          <div style={{ fontSize:9, color:'var(--text-tertiary)', marginBottom:4 }}>Composição das despesas</div>
          <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', gap:1 }}>
            {[
              { v: config.icms, c: '#f06b6b', l: 'ICMS' },
              { v: config.pisCofins, c: '#fb923c', l: 'PIS/COFINS' },
              { v: config.comissao, c: '#f5a623', l: 'Comissão' },
              { v: config.frete, c: '#22d3a0', l: 'Frete' },
              { v: config.despesasFixas, c: '#5b8dee', l: 'Desp.Fixas' },
              { v: config.lucroDesejado, c: '#9b7bea', l: 'Lucro' },
            ].map((item) => (
              <div key={item.l} style={{ flex: item.v, background: item.c, minWidth: item.v > 0 ? 2 : 0, transition:'flex .3s' }} title={`${item.l}: ${item.v}%`} />
            ))}
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
            {[
              { v: config.icms, c: '#f06b6b', l: 'ICMS' },
              { v: config.pisCofins, c: '#fb923c', l: 'PIS/COFINS' },
              { v: config.comissao, c: '#f5a623', l: 'Comissão' },
              { v: config.frete, c: '#22d3a0', l: 'Frete' },
              { v: config.despesasFixas, c: '#5b8dee', l: 'Desp.' },
              { v: config.lucroDesejado, c: '#9b7bea', l: 'Lucro' },
            ].map((item) => (
              <span key={item.l} style={{ fontSize:8, display:'flex', alignItems:'center', gap:3, color:'var(--text-secondary)' }}>
                <span style={{ width:6, height:6, borderRadius:1, background:item.c, flexShrink:0 }} />
                {item.l} {item.v}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quick Calculator ──────────────────────────────────────────────────────────
function QuickCalculator({ config }: { config: GlobalConfig }) {
  const [custo,    setCusto]    = useState(0)
  const [lucroAdj, setLucroAdj] = useState(config.lucroDesejado)
  const [copied,   setCopied]   = useState(false)

  const totalDesp  = config.icms + config.pisCofins + config.comissao + config.frete + config.despesasFixas
  const result     = calcMarkup(custo, totalDesp, lucroAdj)

  const copyPrice  = () => {
    navigator.clipboard.writeText(result.precoVenda.toFixed(2))
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card" style={{ padding:'1rem 1.1rem' }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem', display:'flex', alignItems:'center', gap:6 }}>
        <Calculator size={12} /> Calculadora Rápida
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <Field label="Custo do Produto (R$)" value={custo} onChange={setCusto} suffix="R$" step={0.01} min={0} />
        <Field label="Lucro Desejado"       value={lucroAdj} onChange={setLucroAdj} suffix="%" step={0.5} min={0} />
      </div>

      {custo > 0 && result.precoVenda > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
          {[
            { label:'Preço de Venda',   value: formatCurrency(result.precoVenda),  color:'var(--accent)', big:true },
            { label:'Markup %',         value: result.markup.toFixed(2)+'%',       color:'var(--info)'            },
            { label:'Margem %',         value: result.margem.toFixed(2)+'%',       color:'var(--success)'         },
            { label:'Markup Divisor',   value: result.markupDivisor.toFixed(4),    color:'var(--text-primary)'    },
          ].map((item) => (
            <div key={item.label} style={{ background:'var(--bg-card2)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize: item.big ? 18 : 14, fontWeight:700, color:item.color, fontFamily:"'IBM Plex Mono'" }}>{item.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-tertiary)', fontSize:12, background:'var(--bg-card2)', borderRadius:8 }}>
          Informe o custo do produto para calcular
        </div>
      )}

      {custo > 0 && result.precoVenda > 0 && (
        <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
          <button onClick={copyPrice}
            style={{ background:'transparent', border:'1px solid var(--border-default)', color:'var(--text-secondary)', borderRadius:6, padding:'5px 12px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}
          >
            {copied ? <CheckCircle2 size={12} style={{ color:'var(--success)' }} /> : <Copy size={12} />}
            {copied ? 'Copiado!' : 'Copiar preço'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Product Pricing Table ─────────────────────────────────────────────────────
function PricingTable({
  items, config, onUpdateCusto, onRemove,
}: {
  items:         PricingItem[]
  config:        GlobalConfig
  onUpdateCusto: (id: string, custo: number) => void
  onRemove:      (id: string) => void
}) {
  const [sortBy,  setSortBy]  = useState<'margem' | 'markup' | 'custo' | 'precoSugerido' | 'margemPraticada'>('margemPraticada')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy]
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [items, sortBy, sortDir])

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>
          Tabela de Precificação — {items.length} produtos
        </span>
        <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>
          Edite o custo para calcular o preço sugerido
        </span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:900 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border-subtle)' }}>
              {[
                { key: null,           label: 'Produto',           align: 'left'  },
                { key: null,           label: 'Preço Praticado',   align: 'right' },
                { key: 'custo',        label: 'Custo (R$)',         align: 'right' },
                { key: null,           label: 'Total Desp.',        align: 'right' },
                { key: 'precoSugerido',label: 'Preço Sugerido',     align: 'right' },
                { key: 'markup',       label: 'Markup %',           align: 'right' },
                { key: 'margem',       label: 'Margem Sugerida',    align: 'right' },
                { key: 'margemPraticada', label: 'Margem Praticada', align: 'right' },
                { key: null,           label: 'Status Real',        align: 'center'},
                { key: null,           label: '',                   align: 'center'},
              ].map((col, i) => (
                <th
                  key={i}
                  onClick={() => col.key && handleSort(col.key as typeof sortBy)}
                  style={{ padding:'7px 12px', textAlign: col.align as 'left'|'right'|'center', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color: col.key === sortBy ? 'var(--accent)' : 'var(--text-secondary)', cursor: col.key ? 'pointer' : 'default', userSelect:'none' }}
                >
                  {col.label}{col.key === sortBy ? (sortDir==='asc'?' ↑':' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const st     = STATUS_META[item.margemStatus]
              const Icon   = st.icon
              const totalD = config.icms + config.pisCofins + config.comissao + config.frete + config.despesasFixas
              const despR  = item.custo > 0 ? item.precoSugerido * (totalD/100) : 0
              return (
                <tr key={item.id}
                  style={{ borderBottom:'1px solid var(--border-subtle)', transition:'background .1s' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(245,166,35,.03)')}
                  onMouseOut={(e)  => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding:'7px 12px', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-primary)', fontWeight:500, fontSize:11 }} title={item.produto}>
                    {item.produto}
                  </td>
                  <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'", fontSize:10 }}>
                    {formatCurrency(item.precoVenda)}
                  </td>
                  <td style={{ padding:'6px 12px', textAlign:'right' }}>
                    <input
                      type="number" min={0} step={0.01}
                      value={item.custo || ''}
                      placeholder="Informe…"
                      onChange={(e) => onUpdateCusto(item.id, parseFloat(e.target.value) || 0)}
                      style={{ width:100, background:'var(--bg-card2)', border:`1px solid ${item.custo > 0 ? 'var(--border-default)' : 'rgba(245,166,35,.4)'}`, color:'var(--text-primary)', borderRadius:6, padding:'4px 8px', fontFamily:"'IBM Plex Mono'", fontSize:11, textAlign:'right', outline:'none' }}
                    />
                  </td>
                  <td style={{ padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono'", fontSize:10 }}>
                    {item.custo > 0 ? formatCurrency(despR) : '—'}
                  </td>
                  <td style={{ padding:'7px 12px', textAlign:'right' }}>
                    <span style={{ color:'var(--accent)', fontFamily:"'IBM Plex Mono'", fontWeight:700, fontSize:12 }}>
                      {item.custo > 0 ? formatCurrency(item.precoSugerido) : '—'}
                    </span>
                  </td>
                  <td style={{ padding:'7px 12px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:11 }}>
                    <span style={{ color: item.custo > 0 ? '#5b8dee' : 'var(--text-tertiary)' }}>
                      {item.custo > 0 ? item.markup.toFixed(2)+'%' : '—'}
                    </span>
                  </td>
                  {/* Margem Sugerida: mostra margem líquida = despesas% + lucroDesejado% */}
                  <td style={{ padding:'7px 12px', textAlign:'right', fontFamily:"'IBM Plex Mono'", fontSize:11 }}>
                    <div>
                      <span style={{ color: item.custo > 0 ? st.color : 'var(--text-tertiary)', fontWeight:700 }}>
                        {item.custo > 0 ? item.margem.toFixed(2)+'%' : '—'}
                      </span>
                      {item.custo > 0 && (
                        <div style={{ fontSize:8, color:'var(--text-tertiary)', marginTop:1, whiteSpace:'nowrap' }}>
                          lucro: {config.lucroDesejado.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Margem Praticada: margem REAL ao preco que esta sendo vendido */}
                  <td style={{ padding:'7px 12px', textAlign:'right' }}>
                    {item.custo > 0 && item.precoVenda > 0 ? (
                      <div>
                        <span style={{ color: item.abaixoDoCusto ? '#f06b6b' : item.margemPraticada >= 0 ? '#22d3a0' : '#f06b6b', fontWeight:700, fontFamily:"'IBM Plex Mono'", fontSize:11 }}>
                          {item.margemPraticada.toFixed(2)}%
                        </span>
                        {item.abaixoDoCusto && (
                          <div style={{ fontSize:8, color:'#f06b6b', marginTop:1, whiteSpace:'nowrap' }}>
                            Custo acima do preco
                          </div>
                        )}
                      </div>
                    ) : <span style={{ color:'var(--text-tertiary)' }}>—</span>}
                  </td>
                  {/* Status Real: baseado no preco praticado, nao no sugerido */}
                  <td style={{ padding:'7px 12px', textAlign:'center' }}>
                    {item.custo > 0 ? (() => {
                      const spMeta = STATUS_META[item.statusPraticado]
                      const SpIcon = spMeta.icon
                      return (
                        <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:4, background:spMeta.bg, color:spMeta.color, display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}>
                          <SpIcon size={9} /> {item.abaixoDoCusto ? 'Custo > Preco' : spMeta.label}
                        </span>
                      )
                    })() : (
                      <span style={{ fontSize:9, color:'var(--text-tertiary)' }}>Sem custo</span>
                    )}
                  </td>
                  <td style={{ padding:'7px 8px', textAlign:'center' }}>
                    <button onClick={() => onRemove(item.id)}
                      style={{ background:'none', border:'none', color:'var(--text-tertiary)', cursor:'pointer', padding:4, borderRadius:4, display:'flex' }}
                      onMouseOver={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseOut={(e)  => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                      <Trash2 size={12} />
                    </button>
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

// ── Margin chart ──────────────────────────────────────────────────────────────
function MarginChart({ items, config }: { items: PricingItem[]; config: GlobalConfig }) {
  const withCost = items.filter((i) => i.custo > 0).slice(0, 15)
  if (!withCost.length) return null

  const data = withCost.map((i) => ({
    name:   i.produto.slice(0, 18),
    margem: parseFloat(i.margem.toFixed(2)),
    markup: parseFloat(i.markup.toFixed(2)),
    fill:   i.margem < 0 ? '#f06b6b' : i.margem < config.lucroDesejado * 0.5 ? '#f5a623' : '#22d3a0',
  }))

  return (
    <div className="card" style={{ padding:'1rem 1.1rem', marginTop:'.75rem' }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>
        Margem por Produto (produtos com custo informado)
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top:0, right:60, bottom:0, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,52,84,.8)" horizontal={false} />
          <XAxis type="number" tick={{ fill:'#94a8bf', fontSize:9, fontFamily:"'IBM Plex Mono'" }} axisLine={false} tickLine={false} unit="%" domain={['auto','auto']} />
          <YAxis type="category" dataKey="name" tick={{ fill:'#c4d1e0', fontSize:10 }} axisLine={false} tickLine={false} width={140} />
          <ReferenceLine x={config.lucroDesejado} stroke="#f5a623" strokeDasharray="4 4" label={{ value:`Meta ${config.lucroDesejado}%`, fill:'#f5a623', fontSize:9, position:'right' }} />
          <ReferenceLine x={0} stroke="#f06b6b" strokeWidth={1} />
          <Tooltip
            formatter={(val:number) => [val.toFixed(2)+'%', 'Margem']}
            contentStyle={ttStyle}
            cursor={{ fill:'rgba(255,255,255,.03)' }}
          />
          <Bar dataKey="margem" radius={[0,4,4,0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Product Adder from sales data ─────────────────────────────────────────────
function ProductAdder({ onAdd, existingIds }: {
  onAdd:       (items: Omit<PricingItem, 'markup'|'margem'|'custoTotal'|'margemStatus'|'statusPraticado'|'margemPraticada'|'abaixoDoCusto'|'precoSugerido'>[]) => void
  existingIds: Set<string>
}) {
  const { derived } = useDashboardStore()
  const [open, setOpen] = useState(false)

  const avail = (derived?.byProduto ?? [])
    .filter((p) => !existingIds.has(p.name))

  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background:'var(--bg-card2)', border:'1px solid var(--border-default)', color:'var(--text-primary)', borderRadius:8, padding:'7px 12px', fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
      >
        <Plus size={13} /> Selecionar produtos do Omiê
      </button>
      {open && (
        <div
          style={{ position:'absolute', top:'100%', right:0, marginTop:6, background:'var(--bg-modal)', border:'1px solid var(--border-default)', borderRadius:12, zIndex:500, width:360, boxShadow:'0 16px 40px rgba(0,0,0,.5)', animation:'fadeIn .15s ease', overflow:'hidden' }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border-subtle)', fontSize:11, fontWeight:600, color:'var(--text-primary)' }}>
            Produtos do Omiê (via sync)
          </div>
          <div style={{ maxHeight:280, overflowY:'auto' }}>
            {avail.map((p) => (
              <button key={p.name}
                onClick={() => {
                  onAdd([{ id: p.name, produto: p.name, custo: 0, precoVenda: p.total / p.orders, despesas: [], lucroDesejado: 0 }])
                  setOpen(false)
                }}
                style={{ width:'100%', background:'none', border:'none', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', textAlign:'left' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-card2)')}
                onMouseOut={(e)  => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontSize:11, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:12 }}>{p.name}</span>
                <span style={{ fontSize:9, color:'var(--text-tertiary)', fontFamily:"'IBM Plex Mono'", flexShrink:0 }}>
                  tk {formatCurrency(p.total/p.orders)}
                </span>
              </button>
            ))}
          </div>
          <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border-subtle)' }}>
            <button
              onClick={() => {
                onAdd(avail.map((p) => ({ id: p.name, produto: p.name, custo: 0, precoVenda: p.total/p.orders, despesas:[], lucroDesejado:0 })))
                setOpen(false)
              }}
              style={{ width:'100%', background:'var(--accent-muted)', border:'1px solid rgba(245,166,35,.3)', color:'var(--accent)', borderRadius:6, padding:'7px 0', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
            >
              Adicionar todos ({avail.length} produtos)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Manual add ────────────────────────────────────────────────────────────────
function ManualAdd({ onAdd }: { onAdd: (item: Omit<PricingItem,'markup'|'margem'|'custoTotal'|'margemStatus'|'statusPraticado'|'margemPraticada'|'abaixoDoCusto'|'precoSugerido'>) => void }) {
  const [nome,   setNome]   = useState('')
  const [custo,  setCusto]  = useState(0)
  const [preco,  setPreco]  = useState(0)

  const handleAdd = () => {
    if (!nome.trim() || custo <= 0) return
    onAdd({ id: nome + Date.now(), produto: nome.trim(), custo, precoVenda: preco, despesas:[], lucroDesejado:0 })
    setNome(''); setCusto(0); setPreco(0)
  }

  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
      <label style={{ display:'flex', flexDirection:'column', gap:4, flex:2 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>Nome do Produto</span>
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mesa de Jantar" className="input" style={{ fontSize:12 }} />
      </label>
      <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>Custo (R$)</span>
        <input type="number" min={0} step={0.01} value={custo||''} onChange={(e) => setCusto(parseFloat(e.target.value)||0)} placeholder="0,00" className="input" style={{ fontSize:12, fontFamily:"'IBM Plex Mono'" }} />
      </label>
      <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)' }}>Preço Atual (R$)</span>
        <input type="number" min={0} step={0.01} value={preco||''} onChange={(e) => setPreco(parseFloat(e.target.value)||0)} placeholder="0,00" className="input" style={{ fontSize:12, fontFamily:"'IBM Plex Mono'" }} />
      </label>
      <button onClick={handleAdd} disabled={!nome.trim() || custo <= 0}
        style={{ background:'var(--accent)', border:'none', color:'#0b0d18', borderRadius:8, padding:'7px 14px', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor: !nome.trim()||custo<=0 ? 'not-allowed' : 'pointer', opacity: !nome.trim()||custo<=0 ? 0.5 : 1, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}
      >
        <Plus size={13} /> Adicionar
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: GlobalConfig = {
  icms:          12,
  pisCofins:     0,      // Simples: 0% (já incluso no DAS). Presumido/Real: 9.25%
  comissao:      5,
  frete:         2,
  despesasFixas: 8,
  lucroDesejado: 15,
  regime:        'simples',
}

export function MarkupPage() {
  const { allRows, derived } = useDashboardStore()
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG)
  const [items,  setItems]  = useState<PricingItem[]>([])

  const totalDesp = config.icms + config.pisCofins + config.comissao + config.frete + config.despesasFixas

  // Recalculate all items when config changes
  const recalcItem = useCallback((raw: { id:string; produto:string; custo:number; precoVenda:number }): PricingItem => {
    const result = calcMarkup(raw.custo, totalDesp, config.lucroDesejado)

    // FIX 1 & 2: margemPraticada = margem LÍQUIDA (desconta despesas% sobre o PV praticado)
    // Fórmula: ((PV − custo) / PV × 100) − despesas%
    // Representa o lucro real em % sobre o preço de venda, após pagar todas as despesas
    const margemPraticada = (raw.custo > 0 && raw.precoVenda > 0)
      ? ((raw.precoVenda - raw.custo) / raw.precoVenda) * 100 - totalDesp
      : 0
    const abaixoDoCusto = raw.custo > 0 && raw.precoVenda > 0 && raw.precoVenda < raw.custo

    return {
      ...raw,
      despesas:        [],
      lucroDesejado:   config.lucroDesejado,
      precoSugerido:   result.precoVenda,
      markup:          result.markup,
      // result.margem = despesas% + lucroDesejado% (margem líquida do preço sugerido)
      margem:          result.margem,
      margemPraticada,
      abaixoDoCusto,
      // custoTotal: custo + despesas em R$ baseadas no preço sugerido (base correta = PV)
      custoTotal:      raw.custo + (result.precoVenda > 0 ? result.precoVenda * (totalDesp / 100) : 0),
      // FIX 3: margemStatus usa função específica para margem sugerida
      // result.margem = despesas% + lucro%, então lucro real = result.margem - totalDesp
      margemStatus:    calcMargemStatusSugerida(result.margem - totalDesp, config.lucroDesejado),
      // statusPraticado usa margem líquida real (já corrigida acima)
      statusPraticado: abaixoDoCusto
        ? 'prejuizo'
        : calcMargemStatusPraticada(margemPraticada, config.lucroDesejado),
    }
  }, [totalDesp, config.lucroDesejado])

  useEffect(() => {
    setItems((prev) => prev.map((item) => recalcItem(item)))
  }, [recalcItem])

  const addItems = (raw: Omit<PricingItem,'markup'|'margem'|'custoTotal'|'margemStatus'|'statusPraticado'|'margemPraticada'|'abaixoDoCusto'|'precoSugerido'>[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id))
      const newItems    = raw.filter((r) => !existingIds.has(r.id)).map(recalcItem)
      return [...prev, ...newItems]
    })
  }

  const updateCusto = (id: string, custo: number) => {
    setItems((prev) => prev.map((item) =>
      item.id === id ? recalcItem({ ...item, custo }) : item
    ))
  }

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id))

  const existingIds = useMemo(() => new Set(items.map((i) => i.id)), [items])

  // Summary stats
  const withCost   = items.filter((i) => i.custo > 0)
  const avgMargem  = withCost.length ? withCost.reduce((s,i) => s+i.margem, 0) / withCost.length : 0
  const aboveMeta  = withCost.filter((i) => i.margem >= config.lucroDesejado).length
  const belowMeta  = withCost.filter((i) => i.margem < config.lucroDesejado && i.margem >= 0).length
  const prejuizo   = withCost.filter((i) => i.margem < 0).length

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:7 }}>
            <Calculator size={15} style={{ color:'var(--accent)' }} />
            Precificação com Markup
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
            Calcule preços com base em custo real, impostos e margem desejada
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => exportMarkupReport(items, config)}
            style={{ background:'var(--bg-card2)', border:'1px solid var(--border-default)', color:'var(--text-primary)', borderRadius:8, padding:'7px 14px', fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <Download size={13} /> Exportar Tabela
          </button>
        )}
      </div>

      {/* Global config */}
      <GlobalConfigPanel config={config} onChange={setConfig} />

      {/* Two columns: calc + adder */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'.75rem' }}>
        <QuickCalculator config={config} />

        {/* Stats + add tools */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {/* Summary */}
          {withCost.length > 0 && (
            <div className="card" style={{ padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:10 }}>Resumo da Tabela</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                {[
                  { label:'Margem média',    value: avgMargem.toFixed(1)+'%',      color:'var(--text-primary)' },
                  { label:'Acima da meta',   value: aboveMeta + ' produtos',       color:'var(--success)' },
                  { label:'Abaixo da meta',  value: belowMeta + ' produtos',       color:'var(--warning)' },
                  { label:'Em prejuízo',     value: prejuizo  + ' produtos',       color: prejuizo > 0 ? 'var(--danger)' : 'var(--text-tertiary)' },
                ].map((s) => (
                  <div key={s.label} style={{ background:'var(--bg-card2)', borderRadius:7, padding:'8px 10px' }}>
                    <div style={{ fontSize:8, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add products */}
          <div className="card" style={{ padding:'1rem 1.1rem', flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'var(--text-secondary)', marginBottom:'.875rem' }}>
              Adicionar Produtos
            </div>
            <div style={{ marginBottom:12 }}>
              <ManualAdd onAdd={(item) => addItems([item])} />
            </div>
            <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'var(--text-secondary)' }}>
                {allRows.length > 0 ? 'Ou importe direto das vendas:' : 'Importe dados de vendas para habilitar'}
              </span>
              {allRows.length > 0 && <ProductAdder onAdd={addItems} existingIds={existingIds} />}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {items.length > 0 ? (
        <>
          <PricingTable items={items} config={config} onUpdateCusto={updateCusto} onRemove={removeItem} />
          <MarginChart  items={items} config={config} />
        </>
      ) : (
        <div className="card" style={{ padding:'4rem 2rem', textAlign:'center' }}>
          <Calculator size={32} style={{ color:'var(--text-tertiary)', display:'block', margin:'0 auto 12px' }} />
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6 }}>
            Adicione produtos para montar sua tabela de preços
          </div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>
            Use a calculadora rápida para um cálculo pontual, ou adicione múltiplos produtos acima
          </div>
        </div>
      )}
    </div>
  )
}
