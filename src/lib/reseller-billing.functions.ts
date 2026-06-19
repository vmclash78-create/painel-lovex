import { createServerFn } from "@tanstack/react-start";
import { getPackage, KEY_PACKAGES } from "./reseller-packages";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveReseller(token: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("resellers")
    .select("id, name, active, password")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Revendedor não encontrado.");
  return data;
}

function authorize(reseller: { password: string | null }, password: string) {
  if ((reseller.password ?? "") !== password) {
    throw new Error("Senha inválida.");
  }
}

export const getResellerBalance = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string }) => d)
  .handler(async ({ data }) => {
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    const admin = await getAdmin();
    const { data: row } = await admin
      .from("reseller_key_balances")
      .select("balance")
      .eq("reseller_id", reseller.id)
      .maybeSingle();
    return { balance: row?.balance ?? 0 };
  });

export const listPurchases = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string }) => d)
  .handler(async ({ data }) => {
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("reseller_purchases")
      .select("id, package_name, quantity, amount, status, mercadopago_payment_id, created_at, paid_at, expires_at, qr_code, qr_code_base64, pix_copy_paste")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listKeyTransactions = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string }) => d)
  .handler(async ({ data }) => {
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("reseller_key_transactions")
      .select("id, type, quantity, description, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPixPurchase = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string; packageId: string }) => d)
  .handler(async ({ data }) => {
    const pkg = getPackage(data.packageId);
    if (!pkg) throw new Error("Pacote inválido.");
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    if (!reseller.active) throw new Error("Revenda inativa.");

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken) throw new Error("Mercado Pago não configurado.");

    const idempotencyKey = crypto.randomUUID();
    const payerEmail = `revenda+${reseller.id}@linux-lovable.app`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: pkg.amount,
        description: `${pkg.name} - ${pkg.quantity} Keys (${reseller.name})`,
        payment_method_id: "pix",
        payer: { email: payerEmail, first_name: reseller.name.split(" ")[0] || "Revendedor", last_name: "Linux" },
        external_reference: `${reseller.id}:${pkg.id}`,
        notification_url: "https://linux-lovable.lovable.app/api/public/mercadopago-webhook",
      }),
    });
    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error", mpJson);
      throw new Error(mpJson?.message || "Falha ao criar cobrança PIX.");
    }
    const td = mpJson?.point_of_interaction?.transaction_data ?? {};
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("reseller_purchases")
      .insert({
        reseller_id: reseller.id,
        package_name: pkg.name,
        quantity: pkg.quantity,
        amount: pkg.amount,
        status: "pending",
        mercadopago_payment_id: String(mpJson.id),
        qr_code: td.qr_code ?? null,
        qr_code_base64: td.qr_code_base64 ?? null,
        pix_copy_paste: td.qr_code ?? null,
        expires_at: mpJson.date_of_expiration ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const checkPurchaseStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string; purchaseId: string }) => d)
  .handler(async ({ data }) => {
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    const admin = await getAdmin();
    const { data: purchase, error } = await admin
      .from("reseller_purchases")
      .select("*")
      .eq("id", data.purchaseId)
      .eq("reseller_id", reseller.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!purchase) throw new Error("Compra não encontrada.");

    if (purchase.status !== "pending") return { status: purchase.status };

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken || !purchase.mercadopago_payment_id) return { status: purchase.status };

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${purchase.mercadopago_payment_id}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    if (!r.ok) return { status: purchase.status };
    const pay = await r.json();

    if (pay.status === "approved") {
      const { data: updated } = await admin
        .from("reseller_purchases")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", purchase.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();
      if (updated) {
        await admin.rpc("credit_reseller_keys", {
          _reseller_id: reseller.id,
          _quantity: purchase.quantity,
          _description: `Compra ${purchase.package_name}`,
          _reference_id: String(purchase.mercadopago_payment_id),
        });
      }
      return { status: "paid" };
    }
    if (pay.status === "cancelled" || pay.status === "rejected") {
      await admin.from("reseller_purchases").update({ status: "cancelled" }).eq("id", purchase.id).eq("status", "pending");
      return { status: "cancelled" };
    }
    if (pay.status === "expired") {
      await admin.from("reseller_purchases").update({ status: "expired" }).eq("id", purchase.id).eq("status", "pending");
      return { status: "expired" };
    }
    return { status: "pending" };
  });

export const consumeKey = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string; description?: string }) => d)
  .handler(async ({ data }) => {
    const reseller = await resolveReseller(data.token);
    authorize(reseller, data.password);
    const admin = await getAdmin();
    const { data: ok, error } = await admin.rpc("consume_reseller_key", {
      _reseller_id: reseller.id,
      _description: data.description ?? "Licença criada",
      _reference_id: null,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Saldo insuficiente. Compre keys para criar licenças.");
    return { ok: true };
  });

export { KEY_PACKAGES };