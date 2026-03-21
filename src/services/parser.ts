// ============================================================
// MÓDULO 2 — Serviço de Parser  (v3 — fixed)
// ============================================================

import * as XLSX from 'xlsx'
import type { SaleRow, ColumnDef, RawRow } from '@/types'

// ── Normalize: lowercase + NFD diacritic removal + non-alphanumeric strip ─────
// 'Descrição' → 'descricao'  (ç→c, ã→a via NFD decomposition)
// 'Faturamento' → 'faturamento'
// Avoids stripping accents entirely (which turned ç→nothing, breaking matching)
const norm = (s: string): string =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritics
    .replace(/[^a-z0-9]/g, '')       // remove non-alphanumeric

// ── Synonym tables ────────────────────────────────────────────────────────────
// Ordered longest/most-specific first for priority matching.
// NOTE: 'faturamento' removed from valor — it causes false positives on
//       columns named "Data do Faturamento" which appear in real BR exports.
const SYNONYMS: Record<string, string[]> = {
  data: [
    'datadofaturamento','datavenda','datapedido','dtvenda',
    'data','date',
  ],
  valor: [
    'totaldemercadoria','totalmercadoria','totalmercadorias',
    'totalvenda','totalpedido','valorbruto','valorvenda',
    'vltotal','vlrtotal',
    'receita','revenue','valor','total','preco','price',
  ],
  cliente: [
    'clientenomefantasia','razaosocial','nomecliente',
    'cliente','customer','nome','name',
  ],
  produto: [
    // 'modelo' intentionally excluded: maps to model-code columns (BVT405),
    // not the full product description. Use 'descricao'/'produto' instead.
    'descricaodoproduto','nomeproduto','descricao',
    'produto','description','item','product','desc',
  ],
  marca:    ['marca','brand','fabricante','fornecedor','manufacturer'],
  vendedor: ['vendedor','consultor','atendente','operador','responsavel','seller','salesperson'],
  bairro:   ['bairro','localidade','regiao','zona','distrito','municipio','cidade','district','neighborhood'],
  qtd:      ['quantidade','quantity','qtd','qty','volume','unidades','amount'],
}

// ── Priority-tiered matching (avoids arbitrary substring false positives) ─────
// Tier 1 — Exact match (score 100):   norm(header) === synonym
// Tier 2 — Header starts with syn (80): catches prefixed headers like 'datavenda2024'
// Tier 3 — Header ends with syn   (70): catches suffixed like 'descricaodoproduto'
// Tier 4 — Syn starts with header  (60): header is a short prefix of synonym
//
// Does NOT use arbitrary .includes() — that caused 'faturamento' to match
// 'datadofaturamentocompleta' and break the entire mapping.
function matchScore(normalizedHeader: string, syn: string): number {
  if (normalizedHeader === syn)                              return 100
  if (normalizedHeader.startsWith(syn) && syn.length >= 4)  return 80
  if (normalizedHeader.endsWith(syn)   && syn.length >= 4)  return 70
  if (syn.startsWith(normalizedHeader) && normalizedHeader.length >= 4) return 60
  return 0
}

// ── Auto-detect column mapping ────────────────────────────────────────────────
// Always resets mapTo based on provided headers.
// Call with columnDefs from store — stale mapTo values are ignored (forceReset).
export function autoDetectMapping(
  headers: string[],
  defs: ColumnDef[],
): ColumnDef[] {
  return defs.map((def) => {
    const syns = SYNONYMS[def.key] ?? def.alts.map(norm)
    let bestHeader = '', bestScore = 0

    for (const h of headers) {
      const nh = norm(h)
      for (const syn of syns) {
        const score = matchScore(nh, syn)
        if (score > bestScore) { bestScore = score; bestHeader = h }
      }
    }

    return { ...def, mapTo: bestScore > 0 ? bestHeader : '' }
  })
}

// ── Smart numeric parser ──────────────────────────────────────────────────────
export function parseNumericValue(raw: unknown): number {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0

  const str = String(raw ?? '').trim().replace(/\s/g, '').replace(/^R\$\s*/i, '')
  if (!str || str === '-') return 0

  // BR format: "1.500,00" — period as thousands, comma as decimal
  const brFormat =
    /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str) ||
    /^\d+(,\d{1,2})$/.test(str)

  if (brFormat) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }

  // US / plain: "1500.50" or "1,500.00"
  return parseFloat(str.replace(/,/g, '')) || 0
}

export function parseIntValue(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw)
  return Math.round(parseNumericValue(raw))
}

// ── Parse XLSX / XLS ──────────────────────────────────────────────────────────
// raw:true → numeric cells come as JS numbers (no format-string loss)
// cellDates:true → date cells come as JS Date objects
export async function parseXLSXFile(
  file: File
): Promise<{ headers: string[]; rows: RawRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<RawRow>(ws, { raw: true, defval: '' })
        if (!json.length) return reject(new Error('Planilha vazia'))
        resolve({ headers: Object.keys(json[0]), rows: json })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

// ── Parse CSV text ────────────────────────────────────────────────────────────
export function parseCSVText(text: string): { headers: string[]; rows: RawRow[] } {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) throw new Error('CSV inválido: mínimo 2 linhas')

  const sep     = lines[0].includes(';') ? ';' : ','
  const headers = splitLine(lines[0], sep).map((h) => h.trim().replace(/^["']|["']$/g, ''))

  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, sep)
    const row: RawRow = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim().replace(/^["']|["']$/g, '')
    })
    return row
  })

  return { headers, rows }
}

function splitLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = '', inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === sep && !inQuote) { result.push(cur); cur = '' }
    else { cur += ch }
  }
  result.push(cur)
  return result
}

// ── Parse date (handles mixed str/Date types from XLSX) ───────────────────────
function parseDate(raw: unknown): Date | null {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw

  // Excel serial (numeric date stored as number when cellDates:false)
  if (typeof raw === 'number' && raw > 1 && raw < 100000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d
  }

  const s = String(raw).trim()
  if (!s) return null

  // dd/MM/yyyy or dd-MM-yyyy  (most common in BR spreadsheets)
  const dmY = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/)
  if (dmY) {
    const year = +dmY[3] < 100 ? +dmY[3] + 2000 : +dmY[3]
    const d    = new Date(year, +dmY[2] - 1, +dmY[1])
    return isNaN(d.getTime()) ? null : d
  }

  // yyyy-MM-dd (ISO)
  const yMd = s.match(/^(\d{4})[/\-](\d{2})[/\-](\d{2})/)
  if (yMd) return new Date(+yMd[1], +yMd[2] - 1, +yMd[3])

  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

// ── Map raw rows → SaleRow[] ──────────────────────────────────────────────────
export function mapToSaleRows(rawRows: RawRow[], defs: ColumnDef[]): SaleRow[] {
  const get = (key: string): string | null =>
    defs.find((d) => d.key === key && d.active && d.mapTo)?.mapTo ?? null

  const valCol     = get('valor')
  if (!valCol) throw new Error('Coluna de valor não encontrada. Verifique o mapeamento.')

  const dateCol    = get('data')
  const clienteCol = get('cliente')
  const bairroCol  = get('bairro')
  const produtoCol = get('produto')
  const marcaCol   = get('marca')
  const vendedorCol= get('vendedor')
  const qtdCol     = get('qtd')

  const str = (col: string | null, fallback: string, r: RawRow): string =>
    col ? (String(r[col] ?? '').trim() || fallback) : fallback

  return rawRows
    .map((r): SaleRow => ({
      _val:      parseNumericValue(r[valCol] ?? 0),
      _cliente:  str(clienteCol,  'Anônimo', r),
      _bairro:   str(bairroCol,   'N/I',     r),
      _produto:  str(produtoCol,  'Produto', r),
      _marca:    str(marcaCol,    'S/Marca', r),
      _vendedor: str(vendedorCol, 'N/A',     r),
      _qtd:      qtdCol ? (parseIntValue(r[qtdCol] ?? 1) || 1) : 1,
      _date:     dateCol ? parseDate(r[dateCol]) : null,
      _raw:      r,
    }))
    .filter((r) => r._val > 0)
}

// ── Mapping report (shown in import success toast) ────────────────────────────
export function buildMappingReport(defs: ColumnDef[]): {
  mapped:   { key: string; label: string; column: string }[]
  unmapped: { key: string; label: string }[]
} {
  const mapped:   { key: string; label: string; column: string }[] = []
  const unmapped: { key: string; label: string }[]                  = []
  for (const d of defs) {
    if (d.active && d.mapTo) mapped.push({ key: d.key, label: d.label, column: d.mapTo })
    else if (d.active)       unmapped.push({ key: d.key, label: d.label })
  }
  return { mapped, unmapped }
}
