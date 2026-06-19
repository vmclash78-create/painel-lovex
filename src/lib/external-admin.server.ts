import { createClient } from "@supabase/supabase-js";

// Service-role client for the user's EXTERNAL Supabase (not Lovable Cloud).
// Server-only. NEVER import from a component or *.functions.ts at module
// top-level — use `await import(...)` inside handlers.
export function getExternalAdmin() {
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const key = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}