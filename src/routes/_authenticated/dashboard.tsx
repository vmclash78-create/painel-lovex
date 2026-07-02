import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { licensesQueryOptions, computeStatus, rankSellers } from "@/lib/licenses";
import { resellersQueryOptions } from "@/lib/resellers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  KeyRound, CheckCircle2, Clock, XCircle, AlertTriangle, Store,
  TrendingUp, Activity, ArrowUpRight, Sparkles, Trophy, Medal,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Licenças" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useQuery(licensesQueryOptions);
  const resellers = useQuery(resellersQueryOptions);

  const stats = useMemo(() => {
    const list = data ?? [];
    const by = (s: string) => list.filter((l) => computeStatus(l) === s).length;
    return {
      total: list.length,
      active: by("active"),
      trial: by("trial"),
      expired: by("expired"),
      revoked: by("revoked"),
    };
  }, [data]);

  const trend = useMemo(() => buildTrend(data ?? []), [data]);
  const distribution = useMemo(() => [
    { name: "Ativas", value: stats.active, color: "oklch(0.68 0.18 245)" },
    { name: "Trial", value: stats.trial, color: "oklch(0.78 0.14 235)" },
    { name: "Expiradas", value: stats.expired, color: "oklch(0.75 0.15 85)" },
    { name: "Revogadas", value: stats.revoked, color: "oklch(0.65 0.21 25)" },
  ].filter((d) => d.value > 0), [stats]);

  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const topSellers = useMemo(
    () => (data ? rankSellers(data).slice(0, 6) : []),
    [data],
  );

  return (
    <section className="space-y-6">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-[var(--gradient-surface)] p-6 shadow-soft sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Visão geral em tempo real
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Dashboard de <span className="text-gradient-primary">Licenças</span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Monitore chaves ativas, revendas e a saúde do seu ecossistema em uma única tela.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-2 shadow-elegant">
              <Link to="/licenses">
                <KeyRound className="h-4 w-4" aria-hidden />
                Gerenciar licenças
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/resellers">
                <Store className="h-4 w-4" aria-hidden />
                Revendas
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Erro ao carregar licenças: {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={stats.total} icon={KeyRound} loading={isLoading} />
        <StatCard label="Ativas" value={stats.active} icon={CheckCircle2} tone="success" loading={isLoading} />
        <StatCard label="Trial" value={stats.trial} icon={Clock} tone="info" loading={isLoading} />
        <StatCard label="Expiradas" value={stats.expired} icon={AlertTriangle} tone="warning" loading={isLoading} />
        <StatCard label="Revogadas" value={stats.revoked} icon={XCircle} tone="danger" loading={isLoading} />
        <StatCard label="Revendas" value={resellers.data?.length ?? 0} icon={Store} tone="info" loading={resellers.isLoading} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Licenças criadas — últimos 14 dias</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Novas chaves emitidas por dia</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              {trend.reduce((a, b) => a + b.value, 0)} total
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.68 0.18 245)" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="oklch(0.68 0.18 245)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip
                      cursor={{ stroke: "oklch(0.68 0.18 245 / 40%)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="oklch(0.68 0.18 245)"
                      strokeWidth={2.5}
                      fill="url(#colBlue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-base">Distribuição</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Status atual das licenças</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : distribution.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <div className="relative h-[220px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    >
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold tabular-nums">{activeRate}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativas</div>
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-3 space-y-1.5">
              {distribution.map((d) => (
                <li key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: d.color }}
                    />
                    <span className="text-muted-foreground">{d.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Lista + revendas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden />
              <CardTitle className="text-base">Últimas licenças</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Link to="/licenses">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma licença ainda.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {data!.slice(0, 8).map((l) => {
                  const s = computeStatus(l);
                  return (
                    <li
                      key={l.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm">{l.license_key}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {l.user_name ?? "—"}
                          {l.created_at ? ` · ${formatRelative(l.created_at)}` : ""}
                        </div>
                      </div>
                      <StatusBadge status={s} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" aria-hidden />
              <CardTitle className="text-base">Revendas</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Link to="/resellers">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {resellers.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (resellers.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma revenda cadastrada.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {resellers.data!.slice(0, 6).map((r) => (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{r.token}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        r.active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {r.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de vendedores */}
      <Card className="shadow-soft">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" aria-hidden />
            <CardTitle className="text-base">Top vendedores</CardTitle>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Chaves vendidas
          </span>
        </CardHeader>
        <CardContent>
          {topSellers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ainda não há vendedores registrados. O ranking aparece após preencher &quot;Vendedor&quot; nas chaves.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {topSellers.map((r, i) => {
                const tone =
                  i === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : i === 1 ? "bg-slate-400/15 text-slate-500 border-slate-400/30"
                  : i === 2 ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                  : "bg-muted text-muted-foreground border-transparent";
                return (
                  <li key={r.seller} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                    <span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${tone}`}>
                      {i < 3 ? <Medal className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{r.seller}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.paid} pagas · {r.trial} trials
                      </p>
                    </div>
                    <span className="text-lg font-bold tabular-nums">{r.total}</span>
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

function buildTrend(list: Array<{ created_at: string | null }>) {
  const days = 14;
  const buckets: { key: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: 0,
    });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const l of list) {
    if (!l.created_at) continue;
    const key = new Date(l.created_at).toISOString().slice(0, 10);
    const i = idx.get(key);
    if (i !== undefined) buckets[i].value += 1;
  }
  return buckets;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
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
      ? "text-emerald-500 dark:text-emerald-400"
      : tone === "info"
        ? "text-primary"
        : tone === "warning"
          ? "text-amber-500 dark:text-amber-400"
          : tone === "danger"
            ? "text-destructive"
            : "text-foreground";
  const tonePill =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 ring-1 ring-emerald-500/20"
      : tone === "info"
        ? "bg-primary/10 text-primary ring-1 ring-primary/25"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-500 dark:text-amber-400 ring-1 ring-amber-500/20"
          : tone === "danger"
            ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
            : "bg-muted text-foreground ring-1 ring-border";
  return (
    <Card className="group relative overflow-hidden border-border/60 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant focus-within:ring-2 focus-within:ring-ring">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent opacity-60"
      />
      <CardContent className="flex items-center justify-between gap-3 py-5">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${toneText}`}>
            {loading ? <Skeleton className="h-8 w-12" /> : value}
          </div>
        </div>
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110 ${tonePill}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
    trial: { label: "Trial", className: "bg-primary/15 text-primary border-primary/30" },
    expired: { label: "Expirada", className: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
    revoked: { label: "Revogada", className: "bg-destructive/15 text-destructive border-destructive/30" },
    paused: { label: "Pausada", className: "bg-muted text-muted-foreground border-border" },
    inactive: { label: "Inativa", className: "bg-muted text-muted-foreground border-border" },
  };
  const v = map[status ?? "active"] ?? map.active;
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}