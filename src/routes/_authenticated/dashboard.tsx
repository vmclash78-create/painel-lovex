import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { licensesQueryOptions, computeStatus } from "@/lib/licenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Licenças" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useQuery(licensesQueryOptions);

  const stats = (() => {
    const list = data ?? [];
    const by = (s: string) => list.filter((l) => computeStatus(l) === s).length;
    return {
      total: list.length,
      active: by("active"),
      trial: by("trial"),
      expired: by("expired"),
      revoked: by("revoked"),
    };
  })();

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das licenças emitidas.</p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Erro ao carregar licenças: {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={KeyRound} loading={isLoading} />
        <StatCard label="Ativas" value={stats.active} icon={CheckCircle2} tone="success" loading={isLoading} />
        <StatCard label="Trial" value={stats.trial} icon={Clock} tone="info" loading={isLoading} />
        <StatCard label="Expiradas" value={stats.expired} icon={AlertTriangle} tone="warning" loading={isLoading} />
        <StatCard label="Revogadas" value={stats.revoked} icon={XCircle} tone="danger" loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas licenças</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma licença ainda.</p>
          ) : (
            <ul className="divide-y">
              {data!.slice(0, 8).map((l) => {
                const s = computeStatus(l);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm">{l.license_key}</div>
                      <div className="truncate text-xs text-muted-foreground">{l.user_name ?? "—"}</div>
                    </div>
                    <StatusBadge status={s} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "info" | "warning" | "danger";
  loading?: boolean;
}) {
  const toneText =
    tone === "success"
      ? "text-emerald-400"
      : tone === "info"
        ? "text-sky-400"
        : tone === "warning"
          ? "text-amber-400"
          : tone === "danger"
            ? "text-destructive"
            : "text-foreground";
  const tonePill =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
      : tone === "info"
        ? "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
          : tone === "danger"
            ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
            : "bg-muted text-foreground ring-1 ring-border";
  return (
    <Card className="relative overflow-hidden shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
      <CardContent className="flex items-center justify-between gap-3 py-5">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${toneText}`}>
            {loading ? <Skeleton className="h-8 w-12" /> : value}
          </div>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tonePill}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    trial: { label: "Trial", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
    expired: { label: "Expirada", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    revoked: { label: "Revogada", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const v = map[status ?? "active"] ?? map.active;
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}