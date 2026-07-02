import { queryOptions } from "@tanstack/react-query";
import { supabase, type Reseller, type License } from "@/integrations/external-supabase/client";

export async function fetchResellers(): Promise<Reseller[]> {
  const { data, error } = await supabase
    .from("resellers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Reseller[];
}

export const resellersQueryOptions = queryOptions({
  queryKey: ["resellers"],
  queryFn: fetchResellers,
});

export async function fetchResellerByToken(token: string): Promise<Reseller | null> {
  const { data, error } = await supabase
    .from("resellers")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as Reseller | null) ?? null;
}

export async function fetchResellerLicenses(resellerId: string): Promise<License[]> {
  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("reseller_id", resellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as License[];
}

export async function countResellerLicenses(resellerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("licenses")
    .select("id", { count: "exact", head: true })
    .eq("reseller_id", resellerId)
    .neq("status", "trial");
  if (error) throw error;
  return count ?? 0;
}

export function generateResellerToken(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}