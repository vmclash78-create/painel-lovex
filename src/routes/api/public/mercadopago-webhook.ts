import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const bodyText = await request.text();
        let body: any = {};
        try { body = JSON.parse(bodyText); } catch {}

        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        const xSignature = request.headers.get("x-signature");
        const xRequestId = request.headers.get("x-request-id");
        const dataId =
          url.searchParams.get("data.id") ||
          body?.data?.id ||
          body?.id;

        // Validate HMAC if secret configured
        if (secret && xSignature) {
          const parts = Object.fromEntries(
            xSignature.split(",").map((p) => p.trim().split("=").map((s) => s.trim())) as [string, string][],
          );
          const ts = parts.ts;
          const v1 = parts.v1;
          if (ts && v1 && dataId) {
            const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;
            const expected = createHmac("sha256", secret).update(manifest).digest("hex");
            const a = Buffer.from(expected);
            const b = Buffer.from(v1);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              console.warn("MP webhook: invalid signature");
              return new Response("invalid signature", { status: 401 });
            }
          }
        }

        const type = body?.type || body?.action || url.searchParams.get("type");
        if (!dataId) return new Response("ok");
        if (type && !String(type).includes("payment")) return new Response("ok");

        const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!mpToken) {
          console.error("MP webhook: missing access token");
          return new Response("missing token", { status: 500 });
        }

        const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${mpToken}` },
        });
        if (!r.ok) {
          console.warn("MP webhook: cannot fetch payment", dataId, r.status);
          return new Response("ok");
        }
        const pay = await r.json();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: purchase } = await supabaseAdmin
          .from("reseller_purchases")
          .select("*")
          .eq("mercadopago_payment_id", String(dataId))
          .maybeSingle();
        if (!purchase) return new Response("ok");

        if (pay.status === "approved" && purchase.status === "pending") {
          const { data: updated } = await supabaseAdmin
            .from("reseller_purchases")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", purchase.id)
            .eq("status", "pending")
            .select()
            .maybeSingle();
          if (updated) {
            await supabaseAdmin.rpc("credit_reseller_keys", {
              _reseller_id: purchase.reseller_id,
              _quantity: purchase.quantity,
              _description: `Compra ${purchase.package_name}`,
              _reference_id: String(dataId),
            });
          }
        } else if ((pay.status === "cancelled" || pay.status === "rejected") && purchase.status === "pending") {
          await supabaseAdmin.from("reseller_purchases").update({ status: "cancelled" }).eq("id", purchase.id).eq("status", "pending");
        } else if (pay.status === "expired" && purchase.status === "pending") {
          await supabaseAdmin.from("reseller_purchases").update({ status: "expired" }).eq("id", purchase.id).eq("status", "pending");
        }

        return new Response("ok");
      },
    },
  },
});