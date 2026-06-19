import { queryOptions } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/supabase/client";

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
});

export function computeStatus(l: License): License["status"] {
  if (l.status === "revoked" || l.status === "revogado") return "revoked";
  if (l.expires_at && new Date(l.expires_at) < new Date()) return "expired";
  if (l.status === "ativo") return "active";
  return l.status ?? "active";
}

export function generateLicenseKey(): string {
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  const hex = Array.from({ length: 8 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
  ).join("");
  return `LL-${digits}-${hex}`;
}