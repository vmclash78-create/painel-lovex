import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";

export const listResellerApiKeys = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ reseller_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: keys, error } = await supabaseAdmin
      .from("reseller_api_keys")
      .select("*")
      .eq("reseller_id", data.reseller_id)
      .order("created_at", { ascending: false });
    
    if (error) throw new Error(error.message);
    return keys;
  });

export const createResellerApiKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ 
    reseller_id: z.string().uuid(),
    name: z.string().min(1).max(100)
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `rk_${randomBytes(24).toString("hex")}`;
    const { data: row, error } = await supabaseAdmin
      .from("reseller_api_keys")
      .insert({
        reseller_id: data.reseller_id,
        api_key: key,
        name: data.name
      })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResellerApiKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reseller_api_keys")
      .delete()
      .eq("id", data.id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  });
