import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

export type ResellerPublic = {
  id: string;
  name: string;
  token: string;
  max_keys: number;
  active: boolean;
  created_at: string | null;
  sells_main: boolean;
  sells_lp: boolean;
  max_keys_lp: number;
};

// Returns a reseller row by token WITHOUT ever exposing the password column.
// Safe to call from the public reseller portal page.
export const getResellerPublicByToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<ResellerPublic | null> => {
    const { getExternalAdmin } = await import("./external-admin.server");
    const supabase = getExternalAdmin();
    const { data: row, error } = await supabase
      .from("resellers")
      .select("id, name, token, max_keys, active, created_at, sells_main, sells_lp, max_keys_lp")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as ResellerPublic | null) ?? null;
  });

// Verifies the reseller password server-side; the plaintext password never
// leaves the server. Returns the sanitized reseller row on success.
export const verifyResellerPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      token: z.string().min(1).max(200),
      password: z.string().min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reseller: ResellerPublic | null }> => {
    const { getExternalAdmin } = await import("./external-admin.server");
    const supabase = getExternalAdmin();
    const { data: row, error } = await supabase
      .from("resellers")
      .select(
        "id, name, token, max_keys, active, created_at, sells_main, sells_lp, max_keys_lp, password",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, reseller: null };
    const stored = String((row as { password: string | null }).password ?? "");
    const provided = data.password;
    const a = Buffer.from(stored);
    const b = Buffer.from(provided);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) return { ok: false, reseller: null };
    const { password: _pw, ...rest } = row as Record<string, unknown>;
    void _pw;
    return { ok: true, reseller: rest as unknown as ResellerPublic };
  });