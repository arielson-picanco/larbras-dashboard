// ============================================================
// services/sync.js — Sincronização Omiê → Supabase
// ============================================================
const cron     = require('node-cron')
const supabase = require('./supabase')
const omie     = require('./omie')
const config   = require('../config')

// ── Upsert em lotes ───────────────────────────────────────────────────────────
async function upsertRows(rows) {
  const BATCH = 500
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('sales')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'omie_id', ignoreDuplicates: false })
    if (error) throw new Error(`Supabase upsert: ${error.message}`)
    total += Math.min(BATCH, rows.length - i)
  }
  return total
}

// ── Core: executar sync num intervalo ────────────────────────────────────────
async function runSyncRange(dateFrom, dateTo) {
  console.log(`[Sync] Iniciando sync de range: ${omie.formatDateBR(dateFrom)} → ${omie.formatDateBR(dateTo)}`)

  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ status: 'running', date_from: dateFrom.toISOString().slice(0,10), date_to: dateTo.toISOString().slice(0,10) })
    .select('id')
    .single()
  const logId = logEntry?.id

  try {
    if (!config.omie.appKey || !config.omie.appSecret)
      throw new Error('Credenciais do Omiê não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET)')

    const rows  = await omie.fetchAllPedidos(dateFrom, dateTo)
    const count = rows.length > 0 ? await upsertRows(rows) : 0

    // Atualiza last_synced_date somente se foi o sync mais recente
    const { data: state } = await supabase.from('sync_state').select('last_synced_date').eq('id', 1).single()
    const currentLast = state?.last_synced_date ? new Date(state.last_synced_date) : null
    if (!currentLast || dateTo > currentLast) {
      await supabase.from('sync_state')
        .update({ last_synced_date: dateTo.toISOString().slice(0,10), updated_at: new Date().toISOString() })
        .eq('id', 1)
    }

    await supabase.from('sync_logs')
      .update({ status: 'success', finished_at: new Date().toISOString(), records_synced: count })
      .eq('id', logId)

    console.log(`[Sync] Concluído — ${count} registros upsertados.`)
    return { success: true, records: count }

  } catch (err) {
    console.error('[Sync] Erro:', err.message)
    await supabase.from('sync_logs')
      .update({ status: 'error', finished_at: new Date().toISOString(), error_msg: err.message })
      .eq('id', logId)
    return { success: false, error: err.message }
  }
}

// ── Sync incremental (usa last_synced_date do banco) ─────────────────────────
async function runSync() {
  const today = new Date(); today.setHours(0,0,0,0)

  const { data: state } = await supabase.from('sync_state').select('last_synced_date').eq('id', 1).single()

  let dateFrom
  if (state?.last_synced_date) {
    dateFrom = new Date(state.last_synced_date)
    // Volta 1 dia para pegar pedidos editados no dia anterior
    dateFrom.setDate(dateFrom.getDate() - 1)
  } else {
    dateFrom = new Date(today)
    dateFrom.setDate(dateFrom.getDate() - 90)
    console.log('[Sync] Primeiro sync — buscando últimos 90 dias')
  }

  return runSyncRange(dateFrom, today)
}

// ── Cron ──────────────────────────────────────────────────────────────────────
function startSyncScheduler() {
  console.log(`[Sync] Agendado: ${config.syncCron} (${config.syncTimezone})`)
  cron.schedule(config.syncCron, () => {
    runSync().catch(err => console.error('[Cron] Erro:', err))
  }, { timezone: config.syncTimezone })
}

module.exports = { runSync, runSyncRange, startSyncScheduler }
