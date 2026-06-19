import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!accessToken) return new Response("missing token", { status: 500 });

        const url = new URL(request.url);
        const bodyText = await request.text();
        let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
        try { body = JSON.parse(bodyText); } catch { /* ignore */ }

        const dataId =
          body?.data?.id?.toString() ||
          url.searchParams.get("data.id") ||
          url.searchParams.get("id") ||
          "";
        const requestId = request.headers.get("x-request-id") ?? "";
        const sigHeader = request.headers.get("x-signature") ?? "";

        // Validate signature (skip if no secret configured to ease initial setup)
        if (secret) {
          const parts = Object.fromEntries(
            sigHeader.split(",").map((p) => {
              const [k, ...rest] = p.trim().split("=");
              return [k, rest.join("=")];
            }),
          );
          const ts = parts.ts;
          const v1 = parts.v1;
          if (!ts || !v1 || !dataId) {
            return new Response("invalid signature", { status: 401 });
          }
          const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
          const expected = createHmac("sha256", secret).update(manifest).digest("hex");
          const a = Buffer.from(expected);
          const b = Buffer.from(v1);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("invalid signature", { status: 401 });
          }
        }

        const type = body?.type ?? url.searchParams.get("type") ?? "";
        if (type !== "payment" && !type.includes("payment")) {
          return new Response("ignored", { status: 200 });
        }
        if (!dataId) return new Response("ignored", { status: 200 });

        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mpRes.ok) {
          console.error("MP fetch failed", mpRes.status, await mpRes.text());
          return new Response("mp fetch failed", { status: 200 });
        }
        const payment = await mpRes.json();
        const paymentId = String(payment.id);
        const status = payment.status as string;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: purchase } = await supabaseAdmin
          .from("reseller_purchases")
          .select("*")
          .eq("mercadopago_payment_id", paymentId)
          .maybeSingle();
        if (!purchase) return new Response("no matching purchase", { status: 200 });

        if (status === "approved" && purchase.status === "pending") {
          const { data: updated } = await supabaseAdmin
            .from("reseller_purchases")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", purchase.id)
            .eq("status", "pending")
            .select("*")
            .maybeSingle();
          if (updated) {
            const { error: rpcErr } = await supabaseAdmin.rpc("credit_reseller_keys", {
              _reseller_id: updated.reseller_id,
              _quantity: updated.quantity,
              _description: `Compra ${updated.package_name}`,
              _reference_id: updated.id,
            });
            if (rpcErr) console.error("credit rpc error", rpcErr);
          }
        } else if (status === "cancelled" || status === "expired") {
          await supabaseAdmin
            .from("reseller_purchases")
            .update({ status })
            .eq("id", purchase.id)
            .eq("status", "pending");
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});