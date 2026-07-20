import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/external-supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, CreditCard, KeySquare, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs — LoveX" }] }),
  component: LogsPage,
});

type TxRow = { id: string; created_at: string; type: string; quantity: number; description: string | null; reseller_id: string };
type PurRow = { id: string; created_at: string; status: string; amount: number; package_name: string; reseller_id: string };

function LogsPage() {
  const qc = useQueryClient();
  const tx = useQuery({
    queryKey: ["reseller-tx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_key_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TxRow[];
    },
  });

  const cancelPending = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reseller_purchases")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra pendente cancelada");
      qc.invalidateQueries({ queryKey: ["reseller-purchases-all"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao cancelar"),
  });
  const purchases = useQuery({
    queryKey: ["reseller-purchases-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_purchases")
        .select("id, created_at, status, amount, package_name, reseller_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PurRow[];
    },
  });

  const merged = [
    ...(tx.data ?? []).map((t) => ({ kind: "tx" as const, at: t.created_at, row: t })),
    ...(purchases.data ?? []).map((p) => ({ kind: "pur" as const, at: p.created_at, row: p })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <section className="space-y-4">
      <Card className="shadow-soft border-border/60">
        <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3.5">
          <ScrollText className="h-4 w-4 text-neon-cyan" aria-hidden />
          <h2 className="text-sm font-semibold">Últimas movimentações</h2>
        </div>
        <CardContent className="p-2 sm:p-3">
          {tx.isLoading || purchases.isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : merged.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sem movimentações registradas.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {merged.map((m) => (
                <li key={`${m.kind}-${m.row.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
                  {m.kind === "tx" ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon-purple/15 text-neon-purple">
                      <KeySquare className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon-lime/15 text-neon-lime">
                      <CreditCard className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0">
                    {m.kind === "tx" ? (
                      <>
                        <div className="truncate text-sm font-medium">
                          {m.row.type === "purchase" ? "Créditos adicionados" : "Key criada"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {m.row.quantity > 0 ? `+${m.row.quantity}` : m.row.quantity}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{m.row.description ?? "—"}</div>
                      </>
                    ) : (
                      <>
                        <div className="truncate text-sm font-medium">
                          Compra PIX — {m.row.package_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {Number(m.row.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.kind === "pur" ? <StatusPill status={m.row.status} /> : null}
                    {m.kind === "pur" && m.row.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("Cancelar esta compra pendente?")) cancelPending.mutate(m.row.id);
                        }}
                        disabled={cancelPending.isPending}
                      >
                        {cancelPending.isPending && cancelPending.variables === m.row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        Cancelar
                      </Button>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{fmt(m.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-neon-lime/15 text-neon-lime border-neon-lime/30",
    pending: "bg-neon-orange/15 text-neon-orange border-neon-orange/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[status] ?? "bg-muted"}>{status}</Badge>;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}