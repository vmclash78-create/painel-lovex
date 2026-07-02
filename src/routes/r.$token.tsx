import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/external-supabase/client";
import { fetchResellerByToken, fetchResellerLicenses } from "@/lib/resellers";
import { computeStatus, generateLicenseKey, isTrialLicense, rankSellers } from "@/lib/licenses";
import { StatusBadge } from "./_authenticated/dashboard";
import { EditLicenseDialog } from "./_authenticated/licenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  KeyRound, Plus, Search, RefreshCw, Ban, Trash2, ShieldAlert, Loader2, Copy,
  Activity, Trophy, UserRound, Medal, Package,
} from "lucide-react";
import { ResetLicenseDialog } from "@/components/reset-license-dialog";
import { toast } from "sonner";
import { BuyKeysDialog } from "@/components/buy-keys-dialog";
import { useServerFn } from "@tanstack/react-start";
import {
  listSecondLicensesByReseller,
  createSecondLicense,
  revokeSecondLicense,
  deleteSecondLicense,
  generateSecondLicenseKey,
  type SecondLicense,
} from "@/lib/second-licenses.functions";

export const Route = createFileRoute("/r/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel de Revenda" }] }),
  component: ResellerPublicPage,
  notFoundComponent: InvalidLinkScreen,
  errorComponent: InvalidLinkScreen,
});

function InvalidLinkScreen() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background px-4">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold">Link inválido ou revogado</h1>
        <p className="text-sm text-muted-foreground">
          Este painel de revenda não está mais disponível. Entre em contato com o
          administrador para obter um novo link.
        </p>
      </div>
    </div>
  );
}

function ResellerPublicPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const reseller = useQuery({
    queryKey: ["reseller", token],
    queryFn: () => fetchResellerByToken(token),
  });

  const storageKey = `reseller_auth_${token}`;
  const [authed, setAuthed] = useState<boolean>(false);
  const [pwInput, setPwInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!reseller.data) return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved && saved === reseller.data.password) {
      setAuthed(true);
    }
  }, [reseller.data, storageKey]);

  const licenses = useQuery({
    queryKey: ["reseller-licenses", reseller.data?.id],
    queryFn: () => fetchResellerLicenses(reseller.data!.id),
    enabled: !!reseller.data?.id && authed,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const list = licenses.data ?? [];
    return list.filter((l) => {
      const okSearch = !search ||
        l.license_key.toLowerCase().includes(search.toLowerCase()) ||
        (l.user_name ?? "").toLowerCase().includes(search.toLowerCase());
      const okStatus = statusFilter === "all" || computeStatus(l) === statusFilter;
      return okSearch && okStatus;
    });
  }, [licenses.data, search, statusFilter]);

  const paidLicenses = (licenses.data ?? []).filter((l) => !isTrialLicense(l));
  const trialCount = (licenses.data ?? []).length - paidLicenses.length;
  const used = paidLicenses.length;
  const max = reseller.data?.max_keys ?? 0;
  const remaining = Math.max(0, max - used);
  const blocked = !reseller.data?.active || remaining <= 0;
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  const activeCount = (licenses.data ?? []).filter((l) => computeStatus(l) === "active").length;
  const expiredCount = (licenses.data ?? []).filter((l) => computeStatus(l) === "expired").length;
  const totalCount = (licenses.data ?? []).length;
  const sellerRanking = useMemo(
    () => rankSellers(licenses.data ?? []).slice(0, 5),
    [licenses.data],
  );

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", id).eq("reseller_id", reseller.data!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença revogada");
      qc.invalidateQueries({ queryKey: ["reseller-licenses", reseller.data?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses").delete()
        .eq("id", id).eq("reseller_id", reseller.data!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença removida");
      qc.invalidateQueries({ queryKey: ["reseller-licenses", reseller.data?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (reseller.isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!reseller.data) return <InvalidLinkScreen />;

  if (!authed) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden />
              Acesso à revenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwInput === (reseller.data?.password ?? "")) {
                  window.localStorage.setItem(storageKey, pwInput);
                  setAuthed(true);
                  toast.success("Acesso liberado");
                } else {
                  toast.error("Senha incorreta");
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="pw">Senha</Label>
                <Input
                  id="pw"
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Informe a senha fornecida pelo administrador.
                </p>
              </div>
              <Button type="submit" className="w-full">Entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Compact top bar */}
      <header className="border-b border-border/50 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <KeyRound className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                <span className="text-muted-foreground">{getGreeting()},</span>
                <span className="truncate">{reseller.data.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">Painel de Revenda</div>
            </div>
          </div>
          {reseller.data.active ? (
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ativa
            </Badge>
          ) : (
            <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
              Inativa
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        {(() => {
          const r = reseller.data!;
          const both = r.sells_main && r.sells_lp;
          if (!both && r.sells_lp && !r.sells_main) {
            return (
              <LpPanel
                resellerId={r.id}
                maxKeys={r.max_keys_lp ?? 0}
                disabled={!r.active}
              />
            );
          }
          if (!both) {
            // sells_main only — fall through to original UI below
            return null;
          }
          return (
            <Tabs defaultValue="main" className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="main" className="gap-1.5">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  Main ({r.max_keys})
                </TabsTrigger>
                <TabsTrigger value="lp" className="gap-1.5">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  LP ({r.max_keys_lp ?? 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="lp" className="space-y-4 mt-0">
                <LpPanel
                  resellerId={r.id}
                  maxKeys={r.max_keys_lp ?? 0}
                  disabled={!r.active}
                />
              </TabsContent>
              <TabsContent value="main" className="space-y-4 mt-0">
                <MainPanelBody />
              </TabsContent>
            </Tabs>
          );
        })()}
        {(!reseller.data!.sells_main && reseller.data!.sells_lp) ? null : (
          reseller.data!.sells_main && !reseller.data!.sells_lp ? (
            <MainPanelBody />
          ) : null
        )}
      </main>
    </div>
  );

  function MainPanelBody() {
    return (
      <>
        {/* Compact stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <CompactStat label="Total" value={totalCount} tone="primary" />
          <CompactStat label="Ativas" value={activeCount} tone="emerald" />
          <CompactStat label="Trials" value={trialCount} tone="amber" />
          <CompactStat label="Expiradas" value={expiredCount} tone="rose" />
        </div>

        {/* Inline quota bar */}
        <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm shrink-0">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Cota</span>
            <span className="font-semibold tabular-nums">{used} / {max}</span>
          </div>
          <div className="flex-1 min-w-[120px]">
            <Progress value={pct} aria-label="Uso da cota" className="h-1.5" />
          </div>
          <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {remaining} restantes · {pct}%
          </div>
        </div>

        {/* Ranking de vendedores */}
        <SellerRankingCard rows={sellerRanking} />

        {/* Licenses toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por chave ou cliente..."
              className="pl-8 h-9"
              aria-label="Buscar"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
                <SelectItem value="revoked">Revogadas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => qc.invalidateQueries({ queryKey: ["reseller-licenses", reseller.data?.id] })}
              aria-label="Recarregar"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
            <NewResellerLicenseDialog
              resellerId={reseller.data.id}
              maxKeys={reseller.data.max_keys}
              currentCount={used}
              disabled={!reseller.data.active}
              quotaReached={remaining <= 0}
            />
            <BuyKeysDialog
              resellerId={reseller.data.id}
              resellerToken={token}
              disabled={!reseller.data.active}
            />
          </div>
        </div>

        {blocked ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div>
              <span className="font-medium text-destructive">Geração bloqueada.</span>{" "}
              <span className="text-muted-foreground">
                {!reseller.data.active
                  ? "Revenda inativa. Contate o administrador."
                  : "Cota esgotada. Solicite mais keys."}
              </span>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Chave</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Expira em</TableHead>
                <TableHead className="text-xs">Disp.</TableHead>
                <TableHead className="text-right text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma licença encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id} className="text-sm">
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span>{l.license_key}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label="Copiar chave"
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(l.license_key); toast.success("Copiado"); }
                            catch { toast.error("Falha ao copiar"); }
                          }}
                        >
                          <Copy className="h-3 w-3" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{l.user_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {l.sold_by ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
                          <UserRound className="h-3 w-3" aria-hidden />
                          {l.sold_by}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={computeStatus(l)} /></TableCell>
                    <TableCell className="text-xs">{formatDate(l.expires_at)}</TableCell>
                    <TableCell className="text-xs">{l.max_devices ?? 1}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditLicenseDialog license={l} />
                        <ResetLicenseDialog
                          license={l}
                          resellerId={reseller.data!.id}
                          invalidateKeys={[
                            ["reseller-licenses", reseller.data!.id],
                            ["licenses"],
                          ]}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={l.status === "revoked" || revoke.isPending}
                          onClick={() => revoke.mutate(l.id)}
                          aria-label="Revogar"
                        >
                          <Ban className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm("Remover esta licença?")) remove.mutate(l.id);
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function CompactStat({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5">
      <div className={"grid h-7 w-7 place-items-center rounded-md text-xs font-bold " + tones[tone]}>
        {label.charAt(0)}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold tracking-tight leading-tight">{value}</p>
      </div>
    </div>
  );
}

function NewResellerLicenseDialog({
  resellerId, maxKeys, currentCount, disabled, quotaReached,
}: { resellerId: string; maxKeys: number; currentCount: number; disabled: boolean; quotaReached: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [soldBy, setSoldBy] = useState("");
  const [status, setStatus] = useState<NonNullable<License["status"]>>("active");
  const [days, setDays] = useState<number>(30);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [key, setKey] = useState<string>("");

  const applyPreset = (
    nextStatus: NonNullable<License["status"]>,
    value: number,
    u: "minutes" | "hours" | "days",
  ) => {
    setStatus(nextStatus);
    setUnit(u);
    setDays(value);
  };

  useEffect(() => {
    if (open) setKey(generateLicenseKey());
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      if (status !== "trial") {
        const { count, error: cErr } = await supabase
          .from("licenses")
          .select("id", { count: "exact", head: true })
          .eq("reseller_id", resellerId)
          .neq("status", "trial");
        if (cErr) throw cErr;
        if ((count ?? 0) >= maxKeys) throw new Error("Cota esgotada.");
      }

      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? days : unit === "hours" ? days * 60 : days * 24 * 60;
      const expires_at = days > 0 ? new Date(Date.now() + days * factor).toISOString() : null;
      const { error } = await supabase.from("licenses").insert({
        license_key: key,
        user_name: userName || "Cliente",
        status,
        expires_at,
        max_devices: maxDevices,
        duration_minutes: days > 0 ? minutesTotal : null,
        reseller_id: resellerId,
        sold_by: soldBy.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença criada");
      qc.invalidateQueries({ queryKey: ["reseller-licenses", resellerId] });
      setOpen(false);
      setKey(generateLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 h-9" disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova licença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
          <DialogDescription>
            Cota: {currentCount}/{maxKeys}. Trials são grátis e não consomem cota.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <div className="space-y-2">
            <Label>Tipo de licença</Label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-md bg-muted/50">
              <Button
                type="button"
                size="sm"
                variant={status === "active" ? "default" : "ghost"}
                disabled={quotaReached}
                onClick={() => applyPreset("active", 30, "days")}
              >
                Normal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={status === "trial" ? "default" : "ghost"}
                onClick={() => applyPreset("trial", 15, "minutes")}
              >
                Trial (grátis)
              </Button>
            </div>
          </div>
          {status === "trial" ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                Presets de teste
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["5 min", 5, "minutes"],
                  ["15 min", 15, "minutes"],
                  ["30 min", 30, "minutes"],
                  ["1 h", 1, "hours"],
                  ["6 h", 6, "hours"],
                  ["24 h", 24, "hours"],
                  ["7 dias", 7, "days"],
                ] as const).map(([label, v, u]) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("trial", v, u)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="lkey">Chave</Label>
            <div className="flex gap-2">
              <Input
                id="lkey"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="font-mono"
                required
              />
              <Button type="button" variant="outline" onClick={() => setKey(generateLicenseKey())}>
                Gerar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="uname">Cliente</Label>
              <Input id="uname" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="useller" className="flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden />
                Vendedor
              </Label>
              <Input id="useller" value={soldBy} onChange={(e) => setSoldBy(e.target.value)} placeholder="Quem vendeu" maxLength={60} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lstatus">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="lstatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldev">Dispositivos</Label>
              <Input id="ldev" type="number" min={1} value={maxDevices} onChange={(e) => setMaxDevices(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ldays">Validade</Label>
              <Input id="ldays" type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunit">Unidade</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                <SelectTrigger id="lunit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Use 0 para sem expiração. Trials podem ter qualquer duração e não consomem cota.</p>
          {quotaReached && status !== "trial" ? (
            <p className="text-xs text-destructive">Cota esgotada — só é possível gerar licenças Trial.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || (quotaReached && status !== "trial")}>{create.isPending ? "Criando..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellerRankingCard({
  rows,
}: {
  rows: Array<{ seller: string; total: number; paid: number; trial: number }>;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-card/50 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden />
        Ranking de vendedores aparece aqui ao preencher o campo &quot;Vendedor&quot; nas próximas chaves.
      </div>
    );
  }
  const medalTone = (i: number) =>
    i === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    : i === 1 ? "bg-slate-400/15 text-slate-500 border-slate-400/30"
    : i === 2 ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
    : "bg-muted text-muted-foreground border-transparent";
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 bg-[var(--gradient-surface)]">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Top vendedores</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Chaves vendidas
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        {rows.map((r, i) => (
          <li key={r.seller} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${medalTone(i)}`}>
              {i < 3 ? <Medal className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.seller}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.paid} paga{r.paid === 1 ? "" : "s"} · {r.trial} trial{r.trial === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums">{r.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
