// ============================================================
// services/sync.js — Sincronização incremental Omiê → Supabase
//
// Lógica:
// 1. Lê sync_state.last_synced_date do banco
// 2. Se null, busca últimos 90 dias (primeiro sync)
// 3. Se definido, busca de last_synced_date até hoje
// 4. Salva os registros no Supabase com upsert (omie_id como chave)
// 5. Atualiza sync_state e insere log
//
// Agendado para rodar às 06:00 Manaus (UTC-4) via node-cron
// ============================================================
const cron     = require('node-cron')
const supabase = require('./supabase')
const omie     = require('./omie')
const config   = require('../config')

// ── Executar sincronização ────────────────────────────────────────────────────
async function runSync() {
  console.log('[Sync] Iniciando sincronização incremental...')

  // Registra início no log
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  const logId = logEntry?.id

  try {
    // 1. Ler última data sincronizada
    const { data: state } = await supabase
      .from('sync_state')
      .select('last_synced_date')
      .eq('id', 1)
      .single()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let dateFrom
    if (state?.last_synced_date) {
      // Sync incremental: começa do dia seguinte ao último sync
      // (ou mesmo dia, para pegar pedidos editados)
      dateFrom = new Date(state.last_synced_date)
      dateFrom.setDate(dateFrom.getDate())  // mesmo dia, para segurança
    } else {
      // Primeiro sync: busca últimos 90 dias
      dateFrom = new Date(today)
      dateFrom.setDate(dateFrom.getDate() - 90)
      console.log('[Sync] Primeiro sync — buscando últimos 90 dias')
    }

    const dateTo = new Date(today)

    // 2. Buscar pedidos do Omiê
    if (!config.omie.appKey || !config.omie.appSecret) {
      throw new Error('Credenciais do Omiê não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET)')
    }

    const rows = await omie.fetchAllPedidos(dateFrom, dateTo)

    if (rows.length === 0) {
      console.log('[Sync] Nenhum pedido novo encontrado.')
    } else {
      // 3. Upsert no Supabase (omie_id garante idempotência)
      // Processa em lotes de 500 para evitar payload gigante
      const BATCH = 500
      let inserted = 0
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const { error } = await supabase
          .from('sales')
          .upsert(batch, { onConflict: 'omie_id', ignoreDuplicates: false })

        if (error) throw new Error(`Supabase upsert: ${error.message}`)
        inserted += batch.length
      }
      console.log(`[Sync] ${inserted} registros upsertados no banco.`)
    }

    // 4. Atualizar estado do sync
    await supabase
      .from('sync_state')
      .update({
        last_synced_date: dateTo.toISOString().slice(0, 10),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', 1)

    // 5. Finalizar log com sucesso
    await supabase
      .from('sync_logs')
      .update({
        status:          'success',
        finished_at:     new Date().toISOString(),
        records_synced:  rows.length,
        date_from:       dateFrom.toISOString().slice(0, 10),
        date_to:         dateTo.toISOString().slice(0, 10),
      })
      .eq('id', logId)

    console.log('[Sync] Sincronização concluída com sucesso.')
    return { success: true, records: rows.length }

  } catch (err) {
    console.error('[Sync] Erro:', err.message)

    await supabase
      .from('sync_logs')
      .update({
        status:      'error',
        finished_at: new Date().toISOString(),
        error_msg:   err.message,
      })
      .eq('id', logId)

    return { success: false, error: err.message }
  }
}

// ── Registrar cron job ────────────────────────────────────────────────────────
function startSyncScheduler() {
  console.log(`[Sync] Agendado para: ${config.syncCron} (${config.syncTimezone})`)

  cron.schedule(config.syncCron, () => {
    runSync().catch(err => console.error('[Sync] Erro no cron:', err))
  }, {
    timezone: config.syncTimezone,
  })
}

module.exports = { runSync, startSyncScheduler }
