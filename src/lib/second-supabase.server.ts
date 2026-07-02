import { createClient } from "@supabase/supabase-js";

// Service-role client for the SECOND external Supabase project.
// Server-only. Load via `await import(...)` inside server fn handlers.
export function getSecondAdmin() {
  const url = process.env.SECOND_SUPABASE_URL;
  const key = process.env.SECOND_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SECOND_SUPABASE_URL / SECOND_SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}