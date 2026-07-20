import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["renew", "switch", "new"]),
  plan_id: z.string().min(1).max(64),
  license_key: z.string().min(3).max(64).optional(),
  customer_phone: z.string().max(40).optional(),
  payer_email: z.string().email().optional(),
});

export const Route = createFileRoute("/api/public/client/create-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = bodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) {
            return Response.json({ error: "invalid_body" }, { status: 400 });
          }
          const body = parsed.data;

          const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
          if (!mpToken) return Response.json({ error: "mp_not_configured" }, { status: 500 });

          const { findClientPlan } = await import("@/lib/client-plans");
          const plan = findClientPlan(body.plan_id);
          if (!plan) return Response.json({ error: "invalid_plan" }, { status: 400 });

          let license_id: string | null = null;
          let license_db: "main" | "lp" | null = null;
          let license_key: string | null = null;

          if (body.action !== "new") {
            if (!body.license_key) {
              return Response.json({ error: "missing_license" }, { status: 400 });
            }
            const { lookupLicense } = await import("@/lib/client-purchase.server");
            const found = await lookupLicense(body.license_key);
            if (!found.found) {
              return Response.json({ error: "license_not_found" }, { status: 404 });
            }
            license_id = found.id;
            license_db = found.db;
            license_key = found.license_key;

            // Switch only supported within LoveX for now.
            if (body.action === "switch") {
              if (found.db !== "main" || plan.db !== "main") {
                return Response.json(
                  { error: "switch_not_supported" },
                  { status: 400 },
                );
              }
            }
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: purchase, error: pErr } = await supabaseAdmin
            .from("client_purchases")
            .insert({
              action: body.action,
              plan_id: plan.id,
              amount: plan.price,
              license_key,
              license_id,
              license_db,
              target_db: plan.db,
              customer_phone: body.customer_phone ?? null,
              status: "pending",
            })
            .select("id")
            .single();
          if (pErr || !purchase) {
            return Response.json({ error: "db_error", detail: pErr?.message }, { status: 500 });
          }

          const externalRef = `c_${purchase.id}`;
          const idempotencyKey = crypto.randomUUID();
          const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${mpToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              transaction_amount: plan.price,
              description: `${plan.name} — ${body.action === "renew" ? "Renovação" : body.action === "switch" ? "Troca de plano" : "Nova key"}`,
              payment_method_id: "pix",
              external_reference: externalRef,
              payer: {
                email:
                  body.payer_email ||
                  `cliente-${purchase.id.slice(0, 8)}@example.com`,
              },
            }),
          });

          const mpJson = await mpRes.json().catch(() => ({}));
          if (!mpRes.ok) {
            console.error("MP client create-payment failed", mpRes.status, JSON.stringify(mpJson));
            await supabaseAdmin
              .from("client_purchases")
              .update({ status: "failed" })
              .eq("id", purchase.id);
            return Response.json({ error: "mp_error", detail: mpJson }, { status: 502 });
          }

          const tx = mpJson?.point_of_interaction?.transaction_data ?? {};
          const qr_code: string | null = tx.qr_code ?? null;
          const qr_code_base64: string | null = tx.qr_code_base64 ?? null;
          const expires: string | null = mpJson?.date_of_expiration ?? null;

          await supabaseAdmin
            .from("client_purchases")
            .update({
              mercadopago_payment_id: String(mpJson.id),
              qr_code,
              qr_code_base64,
              pix_copy_paste: qr_code,
              expires_at: expires,
            })
            .eq("id", purchase.id);

          return Response.json({
            purchaseId: purchase.id,
            qr_code,
            qr_code_base64,
            amount: plan.price,
            expires_at: expires,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error("[client create-payment]", msg);
          return Response.json({ error: "server_error", detail: msg }, { status: 500 });
        }
      },
    },
  },
});