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
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      token: String(r.token ?? ""),
      max_keys: Number(r.max_keys ?? 0),
      active: Boolean(r.active),
      created_at: (r.created_at as string | null) ?? null,
      sells_main: r.sells_main === undefined ? true : Boolean(r.sells_main),
      sells_lp: r.sells_lp === undefined ? false : Boolean(r.sells_lp),
      max_keys_lp: Number(r.max_keys_lp ?? 0),
    };
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
    const r = row as Record<string, unknown>;
    const stored = String((r.password as string | null) ?? "");
    const provided = data.password;
    const a = Buffer.from(stored);
    const b = Buffer.from(provided);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) return { ok: false, reseller: null };
    return {
      ok: true,
      reseller: {
        id: String(r.id),
        name: String(r.name ?? ""),
        token: String(r.token ?? ""),
        max_keys: Number(r.max_keys ?? 0),
        active: Boolean(r.active),
        created_at: (r.created_at as string | null) ?? null,
        sells_main: r.sells_main === undefined ? true : Boolean(r.sells_main),
        sells_lp: r.sells_lp === undefined ? false : Boolean(r.sells_lp),
        max_keys_lp: Number(r.max_keys_lp ?? 0),
      },
    };
  });