import { createClient } from "@supabase/supabase-js";

// External Supabase project (user-managed). Lovable Cloud env vars are ignored.
const SUPABASE_URL = "https://iaqnajvrrzfbgmvapoug.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcW5hanZycnpmYmdtdmFwb3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODc1NTUsImV4cCI6MjA5NzM2MzU1NX0.nCHRJIywf1H2_a9om3xrlvlCZogowld4-K5k1HUTJao";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type License = {
  id: string;
  license_key?: string | null;
  user_name?: string | null;
  user_id?: string | null;
  status: string | null;
  expires_at: string | null;
  activated_at?: string | null;
  device_id?: string | null;
  session_id?: string | null;
  max_devices?: number | null;
  created_at: string | null;
  updated_at?: string | null;
  duration_minutes?: number | null;
  reseller_id?: string | null;
};

export type Reseller = {
  id: string;
  name: string;
  token: string;
  max_keys: number;
  active: boolean;
  created_at: string | null;
  password: string | null;
};