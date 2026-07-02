import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
};

export const listSecondLicenses = createServerFn({ method: "GET" }).handler(
  async (): Promise<SecondLicense[]> => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SecondLicense[];
  },
);

const createSchema = z.object({
  license_key: z.string().min(3),
  user_name: z.string().optional(),
  status: z.enum(["active", "trial", "expired", "revoked", "paused", "inactive"]).default("active"),
  expires_at: z.string().nullable().optional(),
  max_devices: z.number().int().min(1).default(1),
  duration_minutes: z.number().int().nullable().optional(),
});

export const createSecondLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { error } = await supabase.from("licenses").insert({
      license_key: data.license_key,
      user_name: data.user_name || "Usuário",
      status: data.status,
      expires_at: data.expires_at ?? null,
      max_devices: data.max_devices,
      duration_minutes: data.duration_minutes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeSecondLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
    const { error } = await supabase
      .from("licenses")
      .update({ status: "revoked", is_active: false, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSecondLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSecondAdmin } = await import("./second-supabase.server");
    const supabase = getSecondAdmin();
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