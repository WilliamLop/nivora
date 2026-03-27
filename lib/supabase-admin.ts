import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

function getServerSupabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && getServerSupabaseKey());
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(process.env.SUPABASE_URL!, getServerSupabaseKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdmin;
}
