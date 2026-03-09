/**
 * Server-side Supabase client for redirects storage.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or when SUPABASE_ENV_PREFIX
 * is set (e.g. QRC for Vercel one-click integration), reads PREFIX_SUPABASE_URL
 * and PREFIX_SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const prefix = (process.env.SUPABASE_ENV_PREFIX ?? "").trim();
  const prefixed = prefix ? process.env[`${prefix}_${name}`] : undefined;
  const unprefixed = process.env[name];
  return (prefixed ?? unprefixed ?? "").trim();
}

const url = getEnv("SUPABASE_URL");
const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key);
}
