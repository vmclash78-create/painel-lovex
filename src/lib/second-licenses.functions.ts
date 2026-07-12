import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSecondAuth } from "./second-auth.middleware";

export type SecondLicense = {
  id: string;
  license_key: string;
  user_name: string | null;
  status: string | null;
  expires_at: string | null;
  activated_at: string | null;
  device_id: string | null;
  session_id: string | null;
  max_devices: number | null;
  duration_minutes: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  reseller_id: string | null;
  sold_by: string | null;
};

export const listSecondLicenses = createServerFn({ method: "GET" })
  .middleware([requireSecondAuth])
  .handler(async ({ context }): Promise<SecondLicense[]> => {
    if (!context.isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SecondLicense[];
  });

export const listSecondLicensesByReseller = createServerFn({ method: "POST" })
  .middleware([requireSecondAuth])
  .inputValidator((input: unknown) => z.object({ reseller_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SecondLicense[]> => {
    if (!context.isAdmin && context.resellerId !== data.reseller_id) {
      throw new Response("Forbidden", { status: 403 });
    }
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { data: rows, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("reseller_id", data.reseller_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as SecondLicense[];
  });

const createSchema = z.object({
  license_key: z.string().min(3),
  user_name: z.string().optional(),
  status: z.enum(["active", "trial", "expired", "revoked", "paused", "inactive"]).default("active"),
  expires_at: z.string().nullable().optional(),
  max_devices: z.number().int().min(1).default(1),
  duration_minutes: z.number().int().nullable().optional(),
  reseller_id: z.string().uuid().nullable().optional(),
  sold_by: z.string().nullable().optional(),
});

export const createSecondLicense = createServerFn({ method: "POST" })
  .middleware([requireSecondAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) {
      // Non-admins may only create licenses within their own reseller scope.
      if (!context.resellerId || data.reseller_id !== context.resellerId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { error } = await supabase.from("licenses").insert({
      license_key: data.license_key,
      user_name: data.user_name || "Usuário",
      status: data.status,
      expires_at: data.expires_at ?? null,
      max_devices: data.max_devices,
      duration_minutes: data.duration_minutes ?? null,
      reseller_id: data.reseller_id ?? null,
      sold_by: data.sold_by ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSecondLicense = createServerFn({ method: "POST" })
  .middleware([requireSecondAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      license_key: z.string().min(3).optional(),
      status: z.enum(["active", "trial", "expired", "revoked", "paused", "inactive"]).optional(),
      expires_at: z.string().nullable().optional(),
      user_name: z.string().optional(),
      max_devices: z.number().int().min(1).optional(),
      device_id: z.string().nullable().optional(),
      activated_at: z.string().nullable().optional(),
      session_id: z.string().nullable().optional(),
      is_active: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    if (!context.isAdmin) {
      const { data: row } = await supabase
        .from("licenses").select("reseller_id").eq("id", data.id).maybeSingle();
      if (!row || row.reseller_id !== context.resellerId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.license_key !== undefined) patch.license_key = data.license_key;
    if (data.status !== undefined) patch.status = data.status;
    if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
    if (data.user_name !== undefined) patch.user_name = data.user_name;
    if (data.max_devices !== undefined) patch.max_devices = data.max_devices;
    if (data.device_id !== undefined) patch.device_id = data.device_id;
    if (data.activated_at !== undefined) patch.activated_at = data.activated_at;
    if (data.session_id !== undefined) patch.session_id = data.session_id;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    const { error } = await supabase.from("licenses").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeSecondLicense = createServerFn({ method: "POST" })
  .middleware([requireSecondAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    if (!context.isAdmin) {
      const { data: row } = await supabase
        .from("licenses").select("reseller_id").eq("id", data.id).maybeSingle();
      if (!row || row.reseller_id !== context.resellerId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }
    const { error } = await supabase
      .from("licenses")
      .update({ status: "revoked", is_active: false, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSecondLicense = createServerFn({ method: "POST" })
  .middleware([requireSecondAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    if (!context.isAdmin) {
      const { data: row } = await supabase
        .from("licenses").select("reseller_id").eq("id", data.id).maybeSingle();
      if (!row || row.reseller_id !== context.resellerId) {
        throw new Response("Forbidden", { status: 403 });
      }
    }
    const { error } = await supabase.from("licenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function generateSecondLicenseKey(): string {
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  const hex = Array.from({ length: 8 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
  ).join("");
  return `LP-${digits}-${hex}`;
}