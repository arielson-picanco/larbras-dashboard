// ============================================================
// config.js — Centraliza variáveis de ambiente com validação
// ============================================================
require('dotenv').config()

const required = (key) => {
  const val = process.env[key]
  if (!val) throw new Error(`Variável de ambiente obrigatória não definida: ${key}`)
  return val
}

module.exports = {
  port:              parseInt(process.env.PORT || '3001'),
  nodeEnv:           process.env.NODE_ENV || 'development',

  supabase: {
    url:             required('SUPABASE_URL'),
    serviceKey:      required('SUPABASE_SERVICE_KEY'),
  },

  jwt: {
    secret:          required('JWT_SECRET'),
    expiresIn:       '7d',
  },

  omie: {
    appKey:          process.env.OMIE_APP_KEY  || '',
    appSecret:       process.env.OMIE_APP_SECRET || '',
    baseUrl:         'https://app.omie.com.br/api/v1',
    pageSize:        50,

    // Etapas do pedido_venda_produto que representam pedidos FATURADOS.
    // Padrão Omiê: '60' = Faturado (NF-e emitida), '70' = Entregue/Concluído.
    //
    // Se os seus códigos forem diferentes, defina no backend/.env:
    //   OMIE_ETAPAS_FATURADO=60,70
    //
    // Para descobrir seus códigos: use "Testar Conexão" no painel Omiê do
    // dashboard e inspecione o campo "etapas_encontradas" no resultado.
    etapasFaturado:  process.env.OMIE_ETAPAS_FATURADO || '60,70',
  },

  ai: {
    geminiKey:       process.env.GEMINI_API_KEY  || '',
    groqKey:         process.env.GROQ_API_KEY    || '',
    anthropicKey:    process.env.ANTHROPIC_API_KEY || '',
  },

  // Sync agendado: todo dia às 06:00 (America/Manaus = UTC-4)
  syncCron:          '0 6 * * *',
  syncTimezone:      'America/Manaus',
}
