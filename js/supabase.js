import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

let client = null;

export function getSupabaseClient() {
  if (client) return client;

  if (!window.supabase?.createClient) {
    throw new Error("The product service could not be loaded.");
  }

  client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return client;
}
