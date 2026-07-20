import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/external-supabase/client";
import { licensesQueryOptions, computeStatus } from "@/lib/licenses";
import { resellersQueryOptions } from "@/lib/resellers";
import { lpLicensesQueryOptions, computeLpStatus } from "@/lib/lp-licenses.hooks";
import { useDb } from "@/contexts/db-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  KeyRound,
  Clock,
  Users,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Puzzle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LoveX" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { db } = useDb();
  const mainLicenses = useQuery({ ...licensesQueryOptions, enabled: db === "main" });
  const lpLicenses = useQuery({
    ...lpLicensesQueryOptions,
    enabled: db === "lp",
    retry: 1,
    throwOnError: false,
  });
  const resellers = useQuery({ ...resellersQueryOptions, enabled: db === "main" });
  const revenue = useQuery({
    queryKey: ["reseller-purchases", "paid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_purchases")
        .select("amount, paid_at, created_at, status")
        .eq("status", "paid");
      if (error) throw error;
      return data ?? [];
    },
    enabled: db === "main",
  });

  const licensesLoading = db === "main" ? mainLicenses.isLoading : lpLicenses.isLoading;
  const mainRows = Array.isArray(mainLicenses.data) ? mainLicenses.data : [];
  const lpRows = Array.isArray(lpLicenses.data) ? lpLicenses.data : [];
  const resellerRows = Array.isArray(resellers.data) ? resellers.data : [];
  const revenueRows = Array.isArray(revenue.data) ? revenue.data : [];
  // Normalize both shapes to a common minimum used here.
  const list = useMemo(() => {
    if (db === "lp") {
      return lpRows.map((l) => ({
        id: l.id,
        license_key: l.license_key,
        user_name: l.user_name,
        status: l.status,
        expires_at: l.expires_at,
        activated_at: l.activated_at,
        created_at: l.created_at,
        _status: computeLpStatus(l),
      }));
    }
    return mainRows.map((l) => ({
      id: l.id,
      license_key: l.license_key,
      user_name: l.user_name,
      status: l.status,
      expires_at: l.expires_at,
      activated_at: l.activated_at,
      created_at: l.created_at,
      _status: computeStatus(l),
    }));
  }, [db, mainRows, lpRows]);

  const stats = useMemo(() => {
    const now = Date.now();
    const inSevenDays = now + 7 * 86_400_000;
    const expiring = list.filter((l) => {
      if (!l.expires_at) return false;
      if (l._status !== "active") return false;
      const t = new Date(l.expires_at).getTime();
      return t >= now && t <= inSevenDays;
    });
    return {
      total: list.length,
      expiring: expiring.length,
      expiringList: expiring
        .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime())
        .slice(0, 5),
    };
  }, [list]);

  const totalRevenue = revenueRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const isLp = db === "lp";

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="Total de Keys"
          value={stats.total.toLocaleString("pt-BR")}
          delta={monthDelta(list.map((l) => l.created_at))}
          series={buildDailySeries(list.map((l) => l.created_at), 14)}
          icon={KeyRound}
          tone="purple"
          loading={licensesLoading}
        />
        <StatCard
          label="Expirando em 7 dias"
          value={stats.expiring.toString()}
          delta={{ value: -8, positiveIsGood: false }}
          series={buildDailySeries(list.map((l) => l.expires_at), 14)}
          icon={Clock}
          tone="orange"
          loading={licensesLoading}
        />
        {!isLp ? (
          <StatCard
          label="Revendedores"
          value={resellerRows.length.toString()}
          delta={{ value: 5, positiveIsGood: true }}
          series={buildDailySeries(resellerRows.map((r) => r.created_at), 14)}
          icon={Users}
          tone="cyan"
          loading={resellers.isLoading}
          />
        ) : null}
        {!isLp ? (
          <StatCard
          label="Receita total"
          value={totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          delta={monthDelta(revenueRows.map((r) => r.paid_at ?? r.created_at))}
          series={buildRevenueSeries(revenueRows, 14)}
          icon={Wallet}
          tone="pink"
          loading={revenue.isLoading}
          />
        ) : null}
      </div>

      <Card className="border-border/60 shadow-soft">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neon-orange/15 text-neon-orange">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h2 className="truncate text-sm font-semibold">
              Keys próximas de expirar {isLp ? "(LP)" : "(Principal)"}
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Link to="/licenses" search={{ filter: "expiring" }}>
              Ver todas <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        <CardContent className="p-2 sm:p-3">
          {licensesLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : stats.expiringList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma key vencendo nos próximos 7 dias.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {stats.expiringList.map((l) => {
                const remaining = timeUntil(l.expires_at);
                const pct = progressPct(l.activated_at, l.expires_at);
                return (
                  <li
                    key={l.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/30"
                  >
                    <Avatar name={l.user_name ?? "?"} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{l.user_name ?? "—"}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{l.license_key}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right leading-tight">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expira em</div>
                        <div className="text-sm font-semibold">{remaining}</div>
                      </div>
                      <RingPct pct={pct} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Button asChild variant="ghost" className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground">
            <Link to="/licenses" search={{ status: "expired" }}>
              Ver todas que estão expirando
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

/* ---------------- reusable status badge ---------------- */

export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-neon-lime/15 text-neon-lime border-neon-lime/30" },
    trial: { label: "Trial", className: "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30" },
    expired: { label: "Expirada", className: "bg-neon-orange/15 text-neon-orange border-neon-orange/30" },
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

/* ---------------- Stat card ---------------- */

type Tone = "purple" | "orange" | "cyan" | "pink";

const TONE: Record<Tone, { icon: string; stroke: string; fill: string; grad: string }> = {
  purple: {
    icon: "bg-neon-purple/15 text-neon-purple",
    stroke: "var(--neon-purple)",
    fill: "var(--neon-purple)",
    grad: "purpleGrad",
  },
  orange: {
    icon: "bg-neon-orange/15 text-neon-orange",
    stroke: "var(--neon-orange)",
    fill: "var(--neon-orange)",
    grad: "orangeGrad",
  },
  cyan: {
    icon: "bg-neon-cyan/15 text-neon-cyan",
    stroke: "var(--neon-cyan)",
    fill: "var(--neon-cyan)",
    grad: "cyanGrad",
  },
  pink: {
    icon: "bg-neon-pink/15 text-neon-pink",
    stroke: "var(--neon-pink)",
    fill: "var(--neon-pink)",
    grad: "pinkGrad",
  },
};

export function StatCard({
  label,
  value,
  delta,
  series,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  delta?: { value: number; positiveIsGood: boolean };
  series: { v: number }[];
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  loading?: boolean;
}) {
  const t = TONE[tone];
  return (
    <Card className="relative overflow-hidden border-border/60 shadow-soft hover:border-primary/40 transition">
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-5">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${t.icon}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <div className="text-3xl font-black tracking-tight tabular-nums">{value}</div>
          )}
          {delta ? <DeltaChip delta={delta} /> : null}
        </div>
        <div className="h-14 w-28 sm:w-36">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={t.grad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.fill} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={t.fill} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={false}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                  padding: "4px 8px",
                }}
                labelFormatter={() => ""}
                formatter={(v: number) => [v, ""]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={t.stroke}
                strokeWidth={2}
                fill={`url(#${t.grad})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaChip({ delta }: { delta: { value: number; positiveIsGood: boolean } }) {
  const positive = delta.value >= 0;
  const good = positive === delta.positiveIsGood;
  const cls = good ? "text-neon-lime" : "text-neon-orange";
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {positive ? "+" : ""}
      {delta.value}% este mês
    </div>
  );
}

/* ---------------- avatar & ring ---------------- */

export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-neon-purple/60 to-neon-pink/60 text-xs font-bold text-primary-foreground">
      {initials}
    </span>
  );
}

export function RingPct({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const size = 36;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  const color =
    clamped < 25 ? "var(--destructive)"
    : clamped < 50 ? "var(--neon-orange)"
    : "var(--neon-lime)";
  return (
    <div className="relative grid h-9 w-9 place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums">{Math.round(clamped)}%</span>
    </div>
  );
}

/* ---------------- helpers ---------------- */

export function buildDailySeries(dates: Array<string | null | undefined>, days: number) {
  const buckets: { v: number }[] = Array.from({ length: days }, () => ({ v: 0 }));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = now.getTime() - (days - 1) * 86_400_000;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t) || t < start || t > now.getTime() + 86_400_000) continue;
    const idx = Math.floor((t - start) / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx].v += 1;
  }
  return buckets;
}

function buildRevenueSeries(rows: Array<{ amount: number | null; paid_at: string | null; created_at: string | null }>, days: number) {
  const buckets: { v: number }[] = Array.from({ length: days }, () => ({ v: 0 }));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = now.getTime() - (days - 1) * 86_400_000;
  for (const r of rows) {
    const d = r.paid_at ?? r.created_at;
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t) || t < start) continue;
    const idx = Math.floor((t - start) / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx].v += Number(r.amount ?? 0);
  }
  return buckets;
}

export function monthDelta(dates: Array<string | null | undefined>) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  let current = 0;
  let previous = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= thisMonth) current++;
    else if (t >= lastMonth) previous++;
  }
  if (previous === 0) return { value: current > 0 ? 100 : 0, positiveIsGood: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { value: pct, positiveIsGood: true };
}

export function timeUntil(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "vencida";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  // Arredonda para cima para bater com daysUntil() usado na página de Licenças.
  // Ex.: 1d 12h => "2 dias" em ambos os lugares (antes: dashboard mostrava "1 dia").
  const d = Math.ceil(diff / 86_400_000);
  if (d < 30) return d === 1 ? "1 dia" : `${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function progressPct(_activated: string | null | undefined, expires: string | null | undefined): number {
  // Urgência baseada nos dias restantes numa janela fixa de 30 dias.
  // Assim o anel bate direto com o texto "Expira em X dias":
  // 30d → 100%, 15d → 50%, 2d → ~7%, vencida → 0%.
  if (!expires) return 0;
  const exp = new Date(expires).getTime();
  if (Number.isNaN(exp)) return 0;
  const daysRemaining = (exp - Date.now()) / 86_400_000;
  const pct = (daysRemaining / 30) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Line/LineChart imported for future use in mini charts; keep referenced to avoid unused warnings.
void LineChart;
void Line;