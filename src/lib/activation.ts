/**
 * Janela de ativação ("carência") das licenças.
 *
 * Regra de negócio:
 * - Ao criar uma chave, o cliente tem ACTIVATION_GRACE_HOURS para fazer o
 *   primeiro acesso sem perder tempo de plano.
 * - Se ele acessar dentro da janela, a extensão registra `activated_at` e a
 *   validade passa a contar desse momento (reconciliada pelo painel).
 * - Se ele NÃO acessar dentro da janela, o tempo começa a contar de qualquer
 *   forma a partir do fim da carência — assim ninguém "estoca" chaves.
 */
export const ACTIVATION_GRACE_HOURS = 48;

export const ACTIVATION_GRACE_MS = ACTIVATION_GRACE_HOURS * 3_600_000;

type ActivationLike = {
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  activated_at?: string | null;
  last_active?: string | null;
  duration_minutes?: number | null;
};

/**
 * Validade gravada na criação: carência + duração do plano.
 * Trials não recebem carência (são curtos por natureza).
 */
export function initialExpiryFromNow(
  durationMs: number,
  opts: { trial?: boolean; from?: Date } = {},
): string | null {
  if (durationMs <= 0) return null;
  const from = opts.from ?? new Date();
  const grace = opts.trial ? 0 : ACTIVATION_GRACE_MS;
  return new Date(from.getTime() + grace + durationMs).toISOString();
}

/** A chave ainda não teve nenhum acesso registrado. */
export function isPendingActivation(l: ActivationLike): boolean {
  if (l.status === "revoked" || l.status === "trial") return false;
  return !l.activated_at && !l.last_active;
}

/** Fim da janela de carência (ISO) ou null quando não se aplica. */
export function graceDeadline(l: ActivationLike): Date | null {
  if (!l.created_at) return null;
  return new Date(new Date(l.created_at).getTime() + ACTIVATION_GRACE_MS);
}

/** Horas restantes para o primeiro acesso sem gastar plano (0 = já começou). */
export function graceHoursLeft(l: ActivationLike, now: Date = new Date()): number {
  const deadline = graceDeadline(l);
  if (!deadline) return 0;
  const ms = deadline.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 3_600_000);
}

/** Texto curto para exibir o estado da carência. */
export function activationLabel(l: ActivationLike, now: Date = new Date()): string | null {
  if (!isPendingActivation(l)) return null;
  const left = graceHoursLeft(l, now);
  if (left > 0) return `Aguardando 1º acesso · ${left}h`;
  return "Carência vencida · contando";
}