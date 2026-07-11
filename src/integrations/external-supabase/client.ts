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
      persistSession: typeof window !== "undefined",
      autoRefreshToken: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: "external-sb-auth",
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
  created_at: string | null;
  updated_at: string | null;
  duration_minutes: number | null;
  reseller_id?: string | null;
  sold_by?: string | null;
  max_version?: string | null;
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