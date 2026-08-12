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
 * daquele momento — removendo a carência que ficou embutida na criação.
 */
export async function reconcile(db: "main" | "lp"): Promise<{ fixed: number }> {
  const admin =
    db === "lp"
      ? (await import("./second-supabase.server")).getSecondAdmin()
      : (await import("./external-admin.server")).getExternalAdmin();

  const { data, error } = await admin
    .from("licenses")
    .select("id, expires_at, activated_at, last_active, created_at, duration_minutes, status")
    .not("expires_at", "is", null)
    .neq("status", "revoked");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  let fixed = 0;

  for (const r of rows) {
    if (r.status === "trial") continue;
    const duration = (r.duration_minutes ?? 0) * 60_000;
    if (duration <= 0 || !r.expires_at || !r.created_at) continue;

    const firstAccess = r.activated_at ?? r.last_active ?? null;
    if (!firstAccess) continue;

    const created = new Date(r.created_at).getTime();
    const access = new Date(firstAccess).getTime();
    const graceMs = ACTIVATION_GRACE_MS();
    // Só reconcilia chaves que ainda carregam a carência embutida.
    const hadGrace = new Date(r.expires_at).getTime() >= created + duration + graceMs - TOLERANCE_MS;
    if (!hadGrace) continue;
    // Acesso após a carência: o tempo já estava correndo, nada a fazer.
    if (access > created + graceMs) continue;

    const target = new Date(access + duration).toISOString();
    const { error: uErr } = await admin
      .from("licenses")
      .update({ expires_at: target })
      .eq("id", r.id);
    if (!uErr) fixed += 1;
  }

  return { fixed };
}