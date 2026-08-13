// Server-only helpers for client (end-user) purchases.
// Never import from client-reachable modules at the top level of
// files that route/components load — always dynamic-import inside handlers.

import { CLIENT_PLANS, findClientPlan } from "@/lib/client-plans";
import { initialExpiryFromNow } from "@/lib/activation";
import { generateLicenseKey } from "@/lib/licenses";
import { generateSecondLicenseKey } from "@/lib/second-licenses.functions";

export type LookupResult =
  | {
      found: true;
      db: "main" | "lp";
      id: string;
      license_key: string;
      user_name: string | null;
      status: string | null;
      expires_at: string | null;
      max_version: string | null;
      customer_phone: string | null;
    }
  | { found: false };

function normalizeKey(k: string) {
  return k.trim().toUpperCase();
}

export async function lookupLicense(rawKey: string): Promise<LookupResult> {
  const key = normalizeKey(rawKey);
  if (!key) return { found: false };

  // Search LoveX (external)
  const { getExternalAdmin } = await import("@/lib/external-admin.server");
  const ext = getExternalAdmin();
  const { data: main } = await ext
    .from("licenses")
    .select("id, license_key, user_name, status, expires_at, max_version, customer_phone")
    .eq("license_key", key)
    .maybeSingle();
  if (main) {
    return {
      found: true,
      db: "main",
      id: String(main.id),
      license_key: String(main.license_key),
      user_name: (main.user_name as string | null) ?? null,
      status: (main.status as string | null) ?? null,
      expires_at: (main.expires_at as string | null) ?? null,
      max_version: (main.max_version as string | null) ?? null,
      customer_phone: (main.customer_phone as string | null) ?? null,
    };
  }

  // Search LovePro (second)
  const { getSecondAdmin } = await import("@/lib/second-supabase.server");
  const lp = getSecondAdmin();
  const { data: sec } = await lp
    .from("licenses")
    .select("id, license_key, user_name, status, expires_at, max_version, customer_phone")
    .eq("license_key", key)
    .maybeSingle();
  if (sec) {
    return {
      found: true,
      db: "lp",
      id: String(sec.id),
      license_key: String(sec.license_key),
      user_name: (sec.user_name as string | null) ?? null,
      status: (sec.status as string | null) ?? null,
      expires_at: (sec.expires_at as string | null) ?? null,
      max_version: (sec.max_version as string | null) ?? null,
      customer_phone: (sec.customer_phone as string | null) ?? null,
    };
  }

  return { found: false };
}

function addDays(base: Date, days: number) {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Apply the effect of an approved client purchase (renew / switch / new).
 * Idempotent-ish: caller guards on purchase.status !== 'paid'.
 */
export async function applyClientPurchase(purchase: {
  id: string;
  action: "renew" | "switch" | "new";
  plan_id: string;
  license_key: string | null;
  license_id: string | null;
  license_db: "main" | "lp" | null;
  target_db: "main" | "lp";
  customer_phone: string | null;
}): Promise<{ new_license_key: string | null }> {
  const plan = findClientPlan(purchase.plan_id);
  if (!plan) throw new Error("unknown plan");

  const now = new Date();
  const thirtyDaysMillis = 30 * 24 * 60 * 60 * 1000;

  if (purchase.action === "new") {
    const key =
      purchase.target_db === "lp" ? generateSecondLicenseKey() : generateLicenseKey();
    // Carência de 48h para o 1º acesso: se o cliente entrar antes, o painel
    // reconcilia a validade para "1º acesso + 30 dias". Se não entrar, o tempo
    // começa a contar do fim da carência.
    const expires = initialExpiryFromNow(thirtyDaysMillis, { status: "active" });

    if (purchase.target_db === "main") {
      const { getExternalAdmin } = await import("@/lib/external-admin.server");
      const admin = getExternalAdmin();
      const { error } = await admin.from("licenses").insert({
        license_key: key,
        user_name: "Cliente",
        status: "active",
        expires_at: expires,
        duration_minutes: 30 * 24 * 60,
        max_devices: 1,
        max_version: plan.maxVersion ?? null,
        customer_phone: purchase.customer_phone ?? null,
        sold_by: "Cliente (auto)",
      });
      if (error) throw new Error(error.message);
    } else {
      const { getSecondAdmin } = await import("@/lib/second-supabase.server");
      const admin = getSecondAdmin();
      const { error } = await admin.from("licenses").insert({
        license_key: key,
        user_name: "Cliente",
        status: "active",
        expires_at: expires,
        duration_minutes: 30 * 24 * 60,
        max_devices: 1,
        customer_phone: purchase.customer_phone ?? null,
        sold_by: "Cliente (auto)",
      });
      if (error) throw new Error(error.message);
    }
    return { new_license_key: key };
  }

  // renew / switch → require existing license
  if (!purchase.license_id || !purchase.license_db) {
    throw new Error("missing license reference");
  }

  // Base expiry: max(now, current expires_at)
  const admin =
    purchase.license_db === "main"
      ? (await import("@/lib/external-admin.server")).getExternalAdmin()
      : (await import("@/lib/second-supabase.server")).getSecondAdmin();

  const { data: existing } = await admin
    .from("licenses")
    .select("expires_at")
    .eq("id", purchase.license_id)
    .maybeSingle();

  const currentExp = existing?.expires_at ? new Date(String(existing.expires_at)) : null;
  const base =
    currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;
  const newExp = new Date(base.getTime() + thirtyDaysMillis).toISOString();

  const patch: Record<string, unknown> = {
    expires_at: newExp,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  if (purchase.action === "switch" && purchase.license_db === "main" && plan.db === "main") {
    patch.max_version = plan.maxVersion ?? null;
  }
  if (purchase.customer_phone) patch.customer_phone = purchase.customer_phone;

  const { error } = await admin.from("licenses").update(patch).eq("id", purchase.license_id);
  if (error) throw new Error(error.message);
  return { new_license_key: null };
}

export function planListForClient() {
  return CLIENT_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    db: p.db,
    maxVersion: p.maxVersion ?? null,
    description: p.description,
    badge: p.badge ?? null,
  }));
}