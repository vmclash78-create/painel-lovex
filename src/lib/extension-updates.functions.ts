import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExtensionUpdate = {
  id: string;
  version: string;
  title: string;
  body: string | null;
  is_lovepro: boolean;
  published_at: string | null;
  created_at: string;
};

export const listExtensionUpdatesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("extension_updates")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ExtensionUpdate[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  version: z.string().min(1).max(32),
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional().nullable(),
  is_lovepro: z.boolean().default(false),
  published_at: z.string().optional().nullable(),
});

export const saveExtensionUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      version: data.version,
      title: data.title,
      body: data.body ?? "",
      is_lovepro: data.is_lovepro,
      published_at: data.published_at ?? new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("extension_updates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("extension_updates").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteExtensionUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("extension_updates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });