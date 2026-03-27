import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseAuthKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function isSupabaseAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseAuthKey());
}

export function createSupabaseUserClient(accessToken?: string): SupabaseClient {
  if (!process.env.SUPABASE_URL || !getSupabaseAuthKey()) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SUPABASE_ANON_KEY (o SUPABASE_PUBLISHABLE_KEY) junto con SUPABASE_URL."
    );
  }

  return createClient(process.env.SUPABASE_URL, getSupabaseAuthKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}
