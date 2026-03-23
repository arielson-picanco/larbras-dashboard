// ============================================================
// services/sync.js — Sincronização Omiê → Supabase
//
// CORREÇÃO: estratégia "replace within range"
// Antes de inserir, apaga todos os registros omie do período
// sincronizado. Isso elimina registros fantasma de syncs
// anteriores que não passam mais pelo filtro de etapa.
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
  const dateFromStr = dateFrom.toISOString().slice(0, 10)
  const dateToStr   = dateTo.toISOString().slice(0, 10)

  console.log(`[Sync] Iniciando sync de range: ${omie.formatDateBR(dateFrom)} → ${omie.formatDateBR(dateTo)}`)

  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ status: 'running', date_from: dateFromStr, date_to: dateToStr })
    .select('id')
    .single()
  const logId = logEntry?.id

  try {
    if (!config.omie.appKey || !config.omie.appSecret)
      throw new Error('Credenciais do Omiê não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET)')

    // 1. Busca os pedidos faturados do período no Omiê
    const rows = await omie.fetchAllPedidos(dateFrom, dateTo)

    // 2. CORREÇÃO: apaga todos os registros omie do período ANTES de inserir.
    //    Isso garante que pedidos que mudaram de etapa (ex: cancelados após
    //    faturamento) ou que existiam de syncs sem filtro de etapa sejam removidos.
    //    Registros de upload (source='upload') NÃO são afetados.
    console.log(`[Sync] Limpando registros Omiê do período ${dateFromStr} → ${dateToStr}...`)
    const { error: deleteError, count: deletedCount } = await supabase
      .from('sales')
      .delete()
      .eq('source', 'omie')
      .gte('data', dateFromStr)
      .lte('data', dateToStr)

    if (deleteError) throw new Error(`Supabase delete: ${deleteError.message}`)
    console.log(`[Sync] ${deletedCount ?? '?'} registros antigos removidos do período`)

    // 3. Insere os registros filtrados (apenas faturados/entregues)
    const count = rows.length > 0 ? await upsertRows(rows) : 0
    console.log(`[Sync] ${count} registros faturados inseridos`)

    // 4. Atualiza last_synced_date
    const { data: stateData } = await supabase
      .from('sync_state')
      .select('last_synced_date')
      .eq('id', 1)
      .single()
    const currentLast = stateData?.last_synced_date ? new Date(stateData.last_synced_date) : null
    if (!currentLast || dateTo > currentLast) {
      await supabase
        .from('sync_state')
        .update({ last_synced_date: dateToStr, updated_at: new Date().toISOString() })
        .eq('id', 1)
    }

    await supabase
      .from('sync_logs')
      .update({ status: 'success', finished_at: new Date().toISOString(), records_synced: count })
      .eq('id', logId)

    console.log(`[Sync] Concluído — ${count} registros upsertados.`)
    return { success: true, records: count }

  } catch (err) {
    console.error('[Sync] Erro:', err.message)
    await supabase
      .from('sync_logs')
      .update({ status: 'error', finished_at: new Date().toISOString(), error_msg: err.message })
      .eq('id', logId)
    return { success: false, error: err.message }
  }
}

// ── Sync incremental (usa last_synced_date do banco) ─────────────────────────
async function runSync() {
  const today = new Date(); today.setHours(0,0,0,0)

  const { data: state } = await supabase
    .from('sync_state')
    .select('last_synced_date')
    .eq('id', 1)
    .single()

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
