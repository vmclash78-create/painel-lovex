import { ACTIVATION_GRACE_MS } from "./activation";

type Row = {
  id: string;
  expires_at: string | null;
  activated_at: string | null;
  last_active?: string | null;
  created_at: string | null;
  duration_minutes: number | null;
  status: string | null;
};

const TOLERANCE_MS = 5 * 60_000;

/**
 * Quando a extensão registra o primeiro acesso, a validade deve passar a contar
 * daquele momento para chaves que ainda não têm expires_at definido.
 */
export async function reconcile(db: "main" | "lp"): Promise<{ fixed: number }> {
  const admin =
    db === "lp"
      ? (await import("./second-supabase.server")).getSecondAdmin()
      : (await import("./external-admin.server")).getExternalAdmin();

  // Buscamos chaves normais sem expires_at mas com registro de acesso
  const { data, error } = await admin
    .from("licenses")
    .select("id, expires_at, activated_at, last_active, duration_minutes, status")
    .is("expires_at", null)
    .neq("status", "revoked")
    .neq("status", "trial")
    .or("activated_at.not.is.null,last_active.not.is.null");

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  let fixed = 0;

  for (const r of rows) {
    const duration = (r.duration_minutes ?? 0) * 60_000;
    if (duration <= 0) continue;

    const firstAccess = r.activated_at ?? r.last_active;
    if (!firstAccess) continue;

    const accessTime = new Date(firstAccess).getTime();
    const expiry = new Date(accessTime + duration).toISOString();

    const { error: uErr } = await admin
      .from("licenses")
      .update({ expires_at: expiry })
      .eq("id", r.id);

    if (!uErr) fixed += 1;
  }

  return { fixed };
}