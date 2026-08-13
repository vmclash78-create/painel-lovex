/**
 * Lógica de ativação das licenças.
 */

export let ACTIVATION_GRACE_HOURS = 48;
export const ACTIVATION_GRACE_MS = () => ACTIVATION_GRACE_HOURS * 3_600_000;

type ActivationLike = {
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  activated_at?: string | null;
  last_active?: string | null;
  duration_minutes?: number | null;
};

/**
 * Define a expiração inicial.
 * - Trial: Começa a contar na hora (from + duration).
 * - Normal: expires_at fica null até o primeiro acesso.
 */
export function initialExpiryFromNow(
  durationMs: number,
  opts: { status?: string | null; from?: Date } = {},
): string | null {
  if (durationMs <= 0) return null;
  const from = opts.from ?? new Date();
  
  // Trial: Expiração imediata (proteção contra farm)
  if (opts.status === "trial") {
    return new Date(from.getTime() + durationMs).toISOString();
  }
  
  // Normal: Sem expiração definida até o primeiro acesso
  return null;
}

export function isPendingActivation(l: ActivationLike): boolean {
  if (l.status === "revoked" || l.status === "trial" || l.status === "expired") return false;
  // Pendente se for normal e ainda não tiver expiração definida (não ativado)
  return !l.expires_at && !l.activated_at && !l.last_active;
}

export function activationLabel(l: ActivationLike): string | null {
  if (isPendingActivation(l)) {
    return "Aguardando 1º acesso";
  }
  return null;
}

