import { queryOptions } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/external-supabase/client";

export async function fetchLicenses(): Promise<License[]> {
  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as License[];
}

export const licensesQueryOptions = queryOptions({
  queryKey: ["licenses"],
  queryFn: fetchLicenses,
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchInterval: 5 * 60_000,
});

export function computeStatus(l: License): License["status"] {
  if (l.status === "revoked") return "revoked";
  
  // Se o relógio do PC estiver atrasado, a comparação local pode mostrar a key como ativa 
  // mesmo que já tenha expirado no servidor. O ideal é sempre confiar na data do banco.
  const now = new Date();
  
  if (l.expires_at) {
    const expirationDate = new Date(l.expires_at);
    if (expirationDate < now) return "expired";
  }
  
  return l.status ?? "active";
}

/**
 * Trial keys are identified strictly by status === "trial".
 * They do NOT count against the reseller quota, regardless of duration.
 */
export function isTrialLicense(l: License): boolean {
  return l.status === "trial";
}

/** Aggregates licenses by seller (`sold_by`), sorted by most-sold. */
export function rankSellers(
  list: License[],
  opts: { paidOnly?: boolean } = {},
): Array<{ seller: string; total: number; paid: number; trial: number }> {
  const map = new Map<string, { total: number; paid: number; trial: number }>();
  for (const l of list) {
    const seller = (l.sold_by ?? "").trim() || "—";
    const cur = map.get(seller) ?? { total: 0, paid: 0, trial: 0 };
    cur.total += 1;
    if (isTrialLicense(l)) cur.trial += 1;
    else cur.paid += 1;
    map.set(seller, cur);
  }
  const arr = Array.from(map.entries()).map(([seller, v]) => ({ seller, ...v }));
  arr.sort((a, b) => (opts.paidOnly ? b.paid - a.paid : b.total - a.total));
  return arr.filter((r) => r.seller !== "—" || (opts.paidOnly ? r.paid > 0 : r.total > 0));
}

export function generateLicenseKey(): string {
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  const hex = Array.from({ length: 8 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
  ).join("");
  return `LX-${digits}-${hex}`;
}