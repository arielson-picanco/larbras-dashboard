// ============================================================
// MÓDULO 8 — Provedores de IA  (v7 — suporte ao backend proxy)
//
// Modo local  (VITE_USE_API=false): chama APIs externas via Vite proxy
// Modo backend (VITE_USE_API=true):  chama /api/ai/* com JWT
// ============================================================

export type AIProvider = 'claude' | 'gemini' | 'groq'

export interface ProviderConfig {
  id: AIProvider; label: string; model: string; envKey: string
  description: string; docsUrl: string; color: string; free: boolean
}

export const PROVIDERS: ProviderConfig[] = [
  { id:'gemini', label:'Gemini',  model:'gemini-2.5-flash',         envKey:'VITE_GEMINI_API_KEY',     description:'Google · Gemini 2.5 Flash — gratuito', docsUrl:'https://aistudio.google.com/app/apikey',          color:'#5b8dee', free:true  },
  { id:'groq',   label:'Groq',    model:'llama-3.1-8b-instant',     envKey:'VITE_GROQ_API_KEY',       description:'Groq · Llama 3.1 8B — gratuito e rápido', docsUrl:'https://console.groq.com/keys',               color:'#22d3a0', free:true  },
  { id:'claude', label:'Claude',  model:'claude-sonnet-4-20250514', envKey:'VITE_ANTHROPIC_API_KEY',  description:'Anthropic · Claude Sonnet 4',           docsUrl:'https://console.anthropic.com/settings/keys', color:'#f5a623', free:false },
]

const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getToken(): string {
  return localStorage.getItem('larbras_token') ?? ''
}

// ── Verificar se provedor está configurado ────────────────────────────────────
// Modo backend: todos os provedores configurados no servidor estão disponíveis
// Modo local: verifica .env.local
export function getConfiguredProviders(): ProviderConfig[] {
  if (USE_API) {
    // No modo backend todas as IAs estão disponíveis (chaves no servidor)
    return PROVIDERS
  }
  return PROVIDERS.filter((p) => {
    const key = (import.meta.env as Record<string,string>)[p.envKey]
    return Boolean(key && key.length > 10)
  })
}

export function isProviderConfigured(id: AIProvider): boolean {
  if (USE_API) return true
  const p = PROVIDERS.find((x) => x.id === id)
  if (!p) return false
  const key = (import.meta.env as Record<string,string>)[p.envKey]
  return Boolean(key && key.length > 10)
}

// ── Robust JSON repair ────────────────────────────────────────────────────────
function repairJSON(raw: string): string {
  if (!raw?.trim()) throw new Error('Resposta vazia do modelo')

  let text = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const start = text.indexOf('{')
  if (start === -1) throw new Error(`Sem JSON na resposta: ${text.slice(0, 100)}`)
  text = text.slice(start)

  try { return JSON.stringify(JSON.parse(text)) } catch { /* repair */ }

  const out: string[] = []
  let inStr = false, esc = false
  const stack: ('{' | '[')[] = []

  for (const ch of text) {
    if (esc) { out.push(ch); esc = false; continue }
    if (ch === '\\' && inStr) { out.push(ch); esc = true; continue }
    if (ch === '"') { inStr = !inStr; out.push(ch); continue }
    if (inStr) { out.push(ch); continue }
    if (ch === '{') stack.push('{')
    if (ch === '[') stack.push('[')
    if (ch === '}' && stack.at(-1) === '{') stack.pop()
    if (ch === ']' && stack.at(-1) === '[') stack.pop()
    out.push(ch)
  }

  let result = out.join('')
  if (inStr) result += '"'
  result = result.trimEnd().replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:\s*$/, '').replace(/,\s*"[^"]*"\s*$/, '')
  while (stack.length) result += stack.pop() === '{' ? '}' : ']'

  try { return JSON.stringify(JSON.parse(result)) }
  catch (e) { throw new Error(`Não foi possível reparar: ${String(e).slice(0, 80)}`) }
}

// ── Chamada unificada (JSON response) ─────────────────────────────────────────
export async function callAI(provider: AIProvider, prompt: string): Promise<string> {
  let raw = ''
  if (USE_API) {
    raw = await callViaBackend(provider, prompt)
  } else {
    if (provider === 'claude') raw = await fetchClaude(prompt)
    if (provider === 'gemini') raw = await fetchGemini(prompt)
    if (provider === 'groq')   raw = await fetchGroq(prompt)
  }
  return repairJSON(raw)
}

// ── Chamada de texto livre (sem JSON) ─────────────────────────────────────────
export async function callAIText(provider: AIProvider, prompt: string): Promise<string> {
  if (USE_API) return callViaBackend(provider, prompt)
  if (provider === 'claude') return fetchClaude(prompt)
  if (provider === 'gemini') return fetchGemini(prompt)
  if (provider === 'groq')   return fetchGroq(prompt)
  throw new Error(`Provedor desconhecido: ${provider}`)
}

// ── Chama backend que faz proxy para a IA ─────────────────────────────────────
async function callViaBackend(provider: AIProvider, prompt: string): Promise<string> {
  const token   = getToken()
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  }

  let body: object
  let res: Response

  if (provider === 'claude') {
    body = { model: 'claude-sonnet-4-20250514', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }
    res  = await fetch(`${API_URL}/api/ai/claude`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const d = await res.json()
    return d.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
  }

  if (provider === 'gemini') {
    body = {
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
    }
    res  = await fetch(`${API_URL}/api/ai/gemini`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const d = await res.json()
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  if (provider === 'groq') {
    body = {
      model: 'llama-3.1-8b-instant', max_tokens: 1800, temperature: 0.2,
      messages: [
        { role: 'system', content: 'Você é analista de negócios de varejo no Brasil. Responda SOMENTE JSON puro e válido. Sem markdown.' },
        { role: 'user',   content: prompt },
      ],
    }
    res  = await fetch(`${API_URL}/api/ai/groq`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const d = await res.json()
    return d.choices?.[0]?.message?.content ?? ''
  }

  throw new Error(`Provedor desconhecido: ${provider}`)
}

// ── Funções locais (Vite proxy) ───────────────────────────────────────────────
async function fetchClaude(prompt: string): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1800, messages:[{role:'user',content:prompt}] }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d.content?.find((b:{type:string}) => b.type==='text')?.text ?? ''
}

async function fetchGemini(prompt: string): Promise<string> {
  const key = (import.meta.env as Record<string,string>).VITE_GEMINI_API_KEY ?? ''
  const url = `/api/gemini/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts:[{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.2 } }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function fetchGroq(prompt: string): Promise<string> {
  const res = await fetch('/api/groq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', max_tokens: 1800, temperature: 0.2,
      messages: [
        { role:'system', content:'Você é analista de negócios de varejo no Brasil. Responda SOMENTE JSON puro e válido. Sem markdown.' },
        { role:'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const d = await res.json()
  return d.choices?.[0]?.message?.content ?? ''
}
