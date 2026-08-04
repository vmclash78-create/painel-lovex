import { createClient } from "@supabase/supabase-js";

// External (self-hosted by the user) Supabase project.
// Publishable/anon keys are safe to ship to the browser.
const EXTERNAL_SUPABASE_URL = "https://gpdjrirlutyeldygqbqs.supabase.co";
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IhEDbJ_WDicR-NG3VH6Bxw_AOTeHz3X";

export const supabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // We never sign users into this external project from the app —
      // it's used only for anon reads/writes via publishable key + RLS.
      // Persisting a session here caused stale/broken JWTs to be sent as
      // Bearer tokens, which PostgREST rejected and returned empty results.
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export type License = {
  id: string;
  license_key: string;
  user_name: string | null;
  status: "active" | "trial" | "expired" | "revoked" | null;
  expires_at: string | null;
  activated_at: string | null;
  device_id: string | null;
  session_id: string | null;
  max_devices: number | null;
  daily_prompts_used?: number | null;
  last_prompt_date?: string | null;
  daily_limit?: number | null;
  created_at: string | null;
  updated_at: string | null;
  duration_minutes: number | null;
  reseller_id?: string | null;
  sold_by?: string | null;
  max_version?: string | null;
  customer_phone?: string | null;
};

export type Reseller = {
  id: string;
  name: string;
  token: string;
  max_keys: number;
  active: boolean;
  created_at: string | null;
  password: string | null;
  sells_main: boolean;
  sells_lp: boolean;
  max_keys_lp: number;
};