import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

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
};

export type Reseller = {
  id: string;
  name: string;
  token: string;
  max_keys: number;
  active: boolean;
  created_at: string | null;
};