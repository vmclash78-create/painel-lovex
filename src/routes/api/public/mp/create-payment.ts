import { createFileRoute } from "@tanstack/react-router";
import { KEY_PACKAGES } from "@/lib/packages";

export const Route = createFileRoute("/api/public/mp/create-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => null) as
            | { resellerId?: string; packageId?: string; payerEmail?: string }
            | null;
          if (!body?.resellerId || !body?.packageId) {
            return Response.json({ error: "missing_fields" }, { status: 400 });
          }
          const pkg = KEY_PACKAGES.find((p) => p.id === body.packageId);
          if (!pkg) return Response.json({ error: "invalid_package" }, { status: 400 });

          const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
          if (!mpToken) return Response.json({ error: "mp_not_configured" }, { status: 500 });

          const { getExternalAdmin } = await import("@/lib/external-admin.server");
          const admin = getExternalAdmin();

          // validate reseller exists & active
          const { data: reseller, error: rErr } = await admin
            .from("resellers").select("id, name, active").eq("id", body.resellerId).maybeSingle();
          if (rErr || !reseller) return Response.json({ error: "reseller_not_found" }, { status: 404 });
          if (!reseller.active) return Response.json({ error: "reseller_inactive" }, { status: 403 });

          // create local purchase row first to get a uuid (used as external_reference)
          const { data: purchase, error: pErr } = await admin
            .from("reseller_purchases").insert({
              reseller_id: reseller.id,
              package_name: pkg.label,
              quantity: pkg.quantity,
              amount: pkg.price,
              status: "pending",
            }).select("id").single();
          if (pErr || !purchase) return Response.json({ error: "db_error", detail: pErr?.message }, { status: 500 });

          // Call MercadoPago to create a Pix payment
          const idempotencyKey = crypto.randomUUID();
          const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${mpToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              transaction_amount: pkg.price,
              description: `${pkg.label} - Revendedor ${reseller.name}`,
              payment_method_id: "pix",
              external_reference: purchase.id,
              payer: { email: body.payerEmail || `revenda+${reseller.id}@noreply.local` },
            }),
          });

          const mpJson = await mpRes.json().catch(() => ({}));
          if (!mpRes.ok) {
            await admin.from("reseller_purchases")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("id", purchase.id);
            return Response.json({ error: "mp_error", detail: mpJson }, { status: 502 });
          }

          const tx = mpJson?.point_of_interaction?.transaction_data ?? {};
          const qr_code = tx.qr_code ?? null;
          const qr_code_base64 = tx.qr_code_base64 ?? null;
          const expires = mpJson?.date_of_expiration ?? null;

          await admin.from("reseller_purchases").update({
            mercadopago_payment_id: String(mpJson.id),
            qr_code,
            qr_code_base64,
            pix_copy_paste: qr_code,
            expires_at: expires,
            updated_at: new Date().toISOString(),
          }).eq("id", purchase.id);

          return Response.json({
            purchaseId: purchase.id,
            paymentId: mpJson.id,
            qr_code,
            qr_code_base64,
            expires_at: expires,
            amount: pkg.price,
            quantity: pkg.quantity,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          return Response.json({ error: "server_error", detail: msg }, { status: 500 });
        }
      },
    },
  },
});