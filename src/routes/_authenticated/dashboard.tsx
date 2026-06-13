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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "info"
        ? "text-sky-600 dark:text-sky-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : tone === "danger"
            ? "text-destructive"
            : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>
            {loading ? <Skeleton className="h-7 w-10" /> : value}
          </div>
        </div>
        <Icon className={`h-6 w-6 ${toneClass}`} aria-hidden />
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    trial: { label: "Trial", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20" },
    expired: { label: "Expirada", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
    revoked: { label: "Revogada", className: "bg-destructive/15 text-destructive border-destructive/20" },
  };
  const v = map[status ?? "active"] ?? map.active;
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}