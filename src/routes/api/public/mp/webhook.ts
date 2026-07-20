import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/mp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const dataIdQS = url.searchParams.get("data.id") ?? url.searchParams.get("id");
          const xSignature = request.headers.get("x-signature") ?? "";
          const xRequestId = request.headers.get("x-request-id") ?? "";
          const rawBody = await request.text();

          let payload: any = {};
          try { payload = JSON.parse(rawBody); } catch {}

          const dataId = String(
            payload?.data?.id ?? dataIdQS ?? payload?.id ?? "",
          );

          // ---- signature verification (MercadoPago) ----
          const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
          if (!webhookSecret) {
            // Fail closed: refuse to process webhooks when the secret is not configured.
            console.error("[mp webhook] MERCADOPAGO_WEBHOOK_SECRET is not configured");
            return new Response("Webhook secret not configured", { status: 500 });
          }
          {
            if (!xSignature || !xRequestId) {
              return new Response("Missing signature headers", { status: 401 });
            }
            const parts = Object.fromEntries(
              xSignature.split(",").map((p) => p.trim().split("=").map((s) => s.trim()) as [string, string]),
            );
            const ts = parts.ts;
            const v1 = parts.v1;
            if (!ts || !v1 || !dataId) {
              return new Response("Bad signature payload", { status: 401 });
            }
            const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
            const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
            const a = Buffer.from(v1, "utf8");
            const b = Buffer.from(expected, "utf8");
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              return new Response("Invalid signature", { status: 401 });
            }
          }

          // Only react to payment notifications
          const topic = payload?.type ?? payload?.topic ?? url.searchParams.get("type");
          if (topic && topic !== "payment") {
            return new Response("ignored", { status: 200 });
          }
          if (!dataId) return new Response("no id", { status: 200 });

          // Fetch fresh payment status from MP
          const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
          if (!mpToken) return new Response("mp not configured", { status: 500 });
          const pRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
          });
          if (!pRes.ok) return new Response("mp fetch failed", { status: 502 });
          const payment = await pRes.json();

          const externalRef: string | undefined = payment.external_reference;
          if (!externalRef) return new Response("no external_reference", { status: 200 });

          // Client (end-user) purchases use a "c_<uuid>" prefix.
          if (externalRef.startsWith("c_")) {
            const cid = externalRef.slice(2);
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: cp } = await supabaseAdmin
              .from("client_purchases")
              .select("id, action, plan_id, license_key, license_id, license_db, target_db, customer_phone, status")
              .eq("id", cid)
              .maybeSingle();
            if (!cp) return new Response("client purchase not found", { status: 200 });

            if (payment.status === "approved" && cp.status !== "paid") {
              const { applyClientPurchase } = await import("@/lib/client-purchase.server");
              const result = await applyClientPurchase({
                id: String(cp.id),
                action: cp.action as "renew" | "switch" | "new",
                plan_id: String(cp.plan_id),
                license_key: (cp.license_key as string | null) ?? null,
                license_id: (cp.license_id as string | null) ?? null,
                license_db: (cp.license_db as "main" | "lp" | null) ?? null,
                target_db: (cp.target_db as "main" | "lp"),
                customer_phone: (cp.customer_phone as string | null) ?? null,
              });
              await supabaseAdmin
                .from("client_purchases")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  mercadopago_payment_id: String(payment.id),
                  new_license_key: result.new_license_key,
                })
                .eq("id", cp.id);
            } else if (["cancelled", "rejected", "expired", "refunded"].includes(payment.status)) {
              await supabaseAdmin
                .from("client_purchases")
                .update({ status: payment.status === "expired" ? "expired" : "failed" })
                .eq("id", cp.id);
            }
            return new Response("ok", { status: 200 });
          }

          const { getExternalAdmin } = await import("@/lib/external-admin.server");
          const admin = getExternalAdmin();

          const { data: purchase, error: gErr } = await admin
            .from("reseller_purchases")
            .select("id, reseller_id, quantity, status")
            .eq("id", externalRef).maybeSingle();
          if (gErr || !purchase) return new Response("purchase not found", { status: 200 });

          if (payment.status === "approved" && purchase.status !== "paid") {
            // mark paid
            await admin.from("reseller_purchases").update({
              status: "paid",
              paid_at: new Date().toISOString(),
              mercadopago_payment_id: String(payment.id),
              updated_at: new Date().toISOString(),
            }).eq("id", purchase.id);

            // credit keys: increment resellers.max_keys
            const { data: reseller } = await admin
              .from("resellers").select("max_keys").eq("id", purchase.reseller_id).maybeSingle();
            const newMax = (reseller?.max_keys ?? 0) + purchase.quantity;
            await admin.from("resellers")
              .update({ max_keys: newMax }).eq("id", purchase.reseller_id);
          } else if (["cancelled", "rejected", "expired", "refunded"].includes(payment.status)) {
            await admin.from("reseller_purchases").update({
              status: payment.status === "expired" ? "expired" : "failed",
              updated_at: new Date().toISOString(),
            }).eq("id", purchase.id);
          }

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("[mp webhook]", e);
          return new Response("error", { status: 500 });
        }
      },
      // MercadoPago sometimes pings with GET for validation
      GET: async () => new Response("ok"),
    },
  },
});