const { createClient } = require('@supabase/supabase-js');

function sanitizeEnv(value) {
  return String(value || '').trim();
}

const supabaseUrl = sanitizeEnv(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey);

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    })
  : null;

module.exports = {
  supabase,
  hasSupabaseConfig
};
