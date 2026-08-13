import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { initialExpiryFromNow } from "@/lib/activation";

const generateSchema = z.object({
  type: z.enum(["lovex", "lovpro"]),
  user_name: z.string().min(1).max(100).optional(),
  days: z.number().int().min(0).max(3650).default(30),
  max_version: z.string().max(20).optional(),
  daily_limit: z.number().int().min(0).optional(),
  max_devices: z.number().int().min(1).max(10).default(1),
});

export const Route = createFileRoute("/api/public/reseller/v1/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = request.headers.get("X-Reseller-API-Key");
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing API Key" }), { 
              status: 401, 
              headers: { "Content-Type": "application/json" } 
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          
          // 1. Validate API Key
          const { data: keyRow, error: keyError } = await supabaseAdmin
            .from("reseller_api_keys")
            .select("reseller_id, id")
            .eq("api_key", apiKey)
            .maybeSingle();

          if (keyError || !keyRow) {
            return new Response(JSON.stringify({ error: "Invalid API Key" }), { 
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }

          // 2. Parse and Validate Body
          const body = await request.json();
          const validation = generateSchema.safeParse(body);
          if (!validation.success) {
            return new Response(JSON.stringify({ error: "Invalid request body", details: validation.error.format() }), { 
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          const { type, user_name, days, max_version, daily_limit, max_devices } = validation.data;

          // 3. Get Reseller Data
          const { getExternalAdmin } = await import("@/lib/external-admin.server");
          const admin = getExternalAdmin();
          
          const { data: reseller, error: resError } = await admin
            .from("resellers")
            .select("*")
            .eq("id", keyRow.reseller_id)
            .maybeSingle();

          if (resError || !reseller) {
            return new Response(JSON.stringify({ error: "Reseller not found" }), { 
              status: 404,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (!reseller.active) {
            return new Response(JSON.stringify({ error: "Reseller account is inactive" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }

          // 4. Check Quota and Generate License
          const isLp = type === "lovpro";
          if (isLp && !reseller.sells_lp) {
            return new Response(JSON.stringify({ error: "Reseller not authorized for Lovpro" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (!isLp && !reseller.sells_main) {
            return new Response(JSON.stringify({ error: "Reseller not authorized for LoveX" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Check main quota (simplified for now)
          const { count, error: countErr } = await admin
            .from("licenses")
            .select("id", { count: "exact", head: true })
            .eq("reseller_id", reseller.id)
            .neq("status", "trial");

          if (!isLp && (count ?? 0) >= reseller.max_keys) {
            return new Response(JSON.stringify({ error: "Quota exceeded for LoveX" }), { 
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Generate Key
          const { generateLicenseKey } = await import("@/lib/licenses");
          const { generateSecondLicenseKey } = await import("@/lib/second-licenses.functions");
          const licenseKey = isLp ? generateSecondLicenseKey() : generateLicenseKey();
          
          const expiresAt = initialExpiryFromNow(days * 86_400_000, { status: "active" });
          const durationMinutes = days > 0 ? days * 24 * 60 : null;

          if (isLp) {
             const { getSecondAdmin } = await import("@/lib/second-supabase.server");
             const lpAdmin = getSecondAdmin();
             const { error: insErr } = await lpAdmin.from("licenses").insert({
               license_key: licenseKey,
               user_name: user_name || "API Client",
               status: "active",
               expires_at: expiresAt,
               max_devices: max_devices,
               duration_minutes: durationMinutes,
               reseller_id: reseller.id,
               sold_by: reseller.name,
               max_version: max_version || null,
               daily_limit: daily_limit ?? 100
             });
             if (insErr) throw insErr;
          } else {
            const { error: insErr } = await admin.from("licenses").insert({
              license_key: licenseKey,
              user_name: user_name || "API Client",
              status: "active",
              expires_at: expiresAt,
              max_devices: max_devices,
              duration_minutes: durationMinutes,
              reseller_id: reseller.id,
              sold_by: reseller.name,
              max_version: max_version || "2.1",
              daily_limit: daily_limit ?? 100
            });
            if (insErr) throw insErr;
          }

          // 5. Update last_used_at
          await supabaseAdmin
            .from("reseller_api_keys")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", keyRow.id);

          return new Response(JSON.stringify({ 
            success: true, 
            license_key: licenseKey,
            type,
            expires_at: expiresAt
          }), { 
            status: 201,
            headers: { "Content-Type": "application/json" }
          });

        } catch (e: any) {
          console.error("[reseller api]", e);
          return new Response(JSON.stringify({ error: "Internal Server Error", message: e.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }
  }
});
