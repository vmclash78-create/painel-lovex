import { createServerFn } from "@tanstack/react-start";
import { getPackage } from "./reseller-packages";

type AdminClient = Awaited<ReturnType<typeof loadAdmin>>;

async function loadAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function resolveReseller(admin: AdminClient, token: string) {
  const { data, error } = await admin
    .from("resellers")
    .select("id, name, active")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Revendedor não encontrado");
  return data;
}

export const getResellerBalance = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const reseller = await resolveReseller(admin, data.token);
    const { data: bal } = await admin
      .from("reseller_key_balances")
      .select("balance")
      .eq("reseller_id", reseller.id)
      .maybeSingle();
    return { balance: bal?.balance ?? 0, resellerId: reseller.id };
  });

export const listPurchases = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const reseller = await resolveReseller(admin, data.token);
    const { data: rows, error } = await admin
      .from("reseller_purchases")
      .select("id, package_name, quantity, amount, status, mercadopago_payment_id, created_at, paid_at, expires_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listKeyTransactions = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const reseller = await resolveReseller(admin, data.token);
    const { data: rows, error } = await admin
      .from("reseller_key_transactions")
      .select("id, type, quantity, description, reference_id, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPixPurchase = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; packageId: string }) => d)
  .handler(async ({ data }) => {
    const pkg = getPackage(data.packageId);
    if (!pkg) throw new Error("Pacote inválido");
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const admin = await loadAdmin();
    const reseller = await resolveReseller(admin, data.token);
    if (!reseller.active) throw new Error("Revenda inativa");

    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const payerEmail = `revenda+${reseller.id}@linux-lovable.app`;

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: pkg.amount,
        description: `Compra de ${pkg.quantity} key(s) - ${reseller.name}`,
        payment_method_id: "pix",
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
        payer: {
          email: payerEmail,
          first_name: reseller.name,
        },
      }),
    });

    const payment = await res.json();
    if (!res.ok) {
      console.error("MP error:", payment);
      throw new Error(payment?.message || "Falha ao criar PIX no Mercado Pago");
    }

    const txData = payment?.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) throw new Error("PIX não retornado pelo Mercado Pago");

    const { data: purchase, error: insErr } = await admin
      .from("reseller_purchases")
      .insert({
        reseller_id: reseller.id,
        package_name: pkg.label,
        quantity: pkg.quantity,
        amount: pkg.amount,
        status: "pending",
        mercadopago_payment_id: String(payment.id),
        qr_code: txData.qr_code,
        qr_code_base64: txData.qr_code_base64,
        pix_copy_paste: txData.qr_code,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    return purchase;
  });

export const checkPurchaseStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; purchaseId: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const reseller = await resolveReseller(admin, data.token);
    const { data: purchase, error } = await admin
      .from("reseller_purchases")
      .select("*")
      .eq("id", data.purchaseId)
      .eq("reseller_id", reseller.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!purchase) throw new Error("Compra não encontrada");

    if (purchase.status === "pending" && purchase.mercadopago_payment_id) {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (accessToken) {
        const mpRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${purchase.mercadopago_payment_id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (mpRes.ok) {
          const payment = await mpRes.json();
          if (payment.status === "approved") {
            await creditIfPending(admin, purchase.id);
            const { data: refreshed } = await admin
              .from("reseller_purchases").select("*").eq("id", purchase.id).maybeSingle();
            return refreshed ?? purchase;
          }
          if (payment.status === "cancelled" || payment.status === "expired") {
            await admin.from("reseller_purchases")
              .update({ status: payment.status })
              .eq("id", purchase.id).eq("status", "pending");
            const { data: refreshed } = await admin
              .from("reseller_purchases").select("*").eq("id", purchase.id).maybeSingle();
            return refreshed ?? purchase;
          }
        }
      }
    }
    return purchase;
  });

async function creditIfPending(admin: AdminClient, purchaseId: string) {
  const { data: updated, error } = await admin
    .from("reseller_purchases")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) return null; // already processed
  const { error: rpcErr } = await admin.rpc("credit_reseller_keys", {
    _reseller_id: updated.reseller_id,
    _quantity: updated.quantity,
    _description: `Compra ${updated.package_name}`,
    _reference_id: updated.id,
  });
  if (rpcErr) throw new Error(rpcErr.message);
  return updated;
}