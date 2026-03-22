// ============================================================
// services/supabase.js — Cliente Supabase com service_role
// O service_role bypassa RLS — use APENAS no backend
// ============================================================
const { createClient } = require('@supabase/supabase-js')
const config           = require('../config')

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: { persistSession: false },
  }
)

module.exports = supabase
