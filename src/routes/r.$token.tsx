import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/external-supabase/client";
import { fetchResellerByToken, fetchResellerLicenses } from "@/lib/resellers";
import { computeStatus, generateLicenseKey, isTrialLicense } from "@/lib/licenses";
import { StatusBadge } from "./_authenticated/dashboard";
import { EditLicenseDialog } from "./_authenticated/licenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Activity, UserRound, Package, FileText, Pencil, RotateCcw,
  CheckCircle2, FlaskConical, XCircle,
} from "lucide-react";
import { ResetLicenseDialog } from "@/components/reset-license-dialog";
import { toast } from "sonner";
import { BuyKeysDialog } from "@/components/buy-keys-dialog";
import { useServerFn } from "@tanstack/react-start";
import {
  listSecondLicensesByReseller,
  createSecondLicense,
  updateSecondLicense,
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
    <div className="min-h-dvh bg-background relative">
      {/* Subtle dot grid background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35] [background-image:radial-gradient(color-mix(in_oklab,var(--foreground)_8%,transparent)_1px,transparent_1px)] [background-size:22px_22px]"
      />
      {/* Hero */}
      <header className="relative border-b border-border/50">
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:justify-between sm:px-5 sm:py-5 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-card text-primary">
              <KeyRound className="h-4.5 w-4.5" aria-hidden />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Painel de Revenda
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
                <span className="text-muted-foreground font-normal">{getGreeting()},</span>
                <span className="truncate text-foreground">{reseller.data.name}</span>
              </h1>
            </div>
          </div>
          {reseller.data.active ? (
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ativa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-destructive/30 bg-destructive/5 text-[11px] font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Inativa
            </span>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-5 space-y-5 sm:px-5 sm:py-6">
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
            <Tabs defaultValue="main" className="space-y-5">
              <TabsList className="grid h-11 w-full grid-cols-2 items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1 backdrop-blur sm:inline-flex sm:w-auto">
                <TabsTrigger
                  value="main"
                  className="h-9 min-w-0 gap-1.5 rounded-full px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                >
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  LoveX
                  <span className="ml-1 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {r.max_keys}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="lp"
                  className="h-9 min-w-0 gap-1.5 rounded-full px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                >
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  Lovpro
                  <span className="ml-1 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {r.max_keys_lp ?? 0}
                  </span>
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
    const r = reseller.data!;
    return (
      <>
        {/* Compact stats row */}
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <GradientStatCard
            label="Total de Licenças"
            description="Todas as licenças geradas"
            value={totalCount}
            tone="primary"
            icon={<FileText className="h-4 w-4" aria-hidden />}
          />
          <GradientStatCard
            label="Ativas"
            description="Licenças ativas"
            value={activeCount}
            tone="emerald"
            percent={totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          />
          <GradientStatCard
            label="Trials"
            description="Licenças em período de teste"
            value={trialCount}
            tone="amber"
            percent={totalCount > 0 ? Math.round((trialCount / totalCount) * 100) : 0}
            icon={<FlaskConical className="h-4 w-4" aria-hidden />}
          />
          <GradientStatCard
            label="Expiradas"
            description="Licenças expiradas"
            value={expiredCount}
            tone="rose"
            percent={totalCount > 0 ? Math.round((expiredCount / totalCount) * 100) : 0}
            icon={<XCircle className="h-4 w-4" aria-hidden />}
          />
        </div>

        {/* Quota bar — premium */}
        <QuotaBar used={used} max={max} pct={pct} remaining={remaining} />

        {/* Licenses toolbar */}
        <div className="grid gap-2.5 sm:flex sm:items-center sm:gap-3">
          <div className="relative min-w-0 sm:flex-1 sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por chave ou cliente..."
              className="pl-8 h-9"
              aria-label="Buscar"
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto sm:items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Filtrar por status">
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
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
              <NewResellerLicenseDialog
                resellerId={r.id}
                maxKeys={r.max_keys}
                currentCount={used}
                disabled={!r.active}
                quotaReached={remaining <= 0}
              />
              <BuyKeysDialog
                resellerId={r.id}
                resellerToken={token}
                disabled={!r.active}
              />
            </div>
          </div>
        </div>

        {blocked ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div>
              <span className="font-medium text-destructive">Geração bloqueada.</span>{" "}
              <span className="text-muted-foreground">
                {!r.active
                  ? "Revenda inativa. Contate o administrador."
                  : "Cota esgotada. Solicite mais keys."}
              </span>
            </div>
          </div>
        ) : null}

        <div className="space-y-2 sm:hidden">
          {licenses.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : filtered.length === 0 ? (
            <MobileEmptyState title="Nenhuma licença encontrada" description="Crie sua primeira licença em Nova licença." />
          ) : (
            filtered.map((l) => (
              <article key={l.id} className="rounded-xl border border-border/60 bg-card p-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="truncate font-mono text-xs font-semibold">{l.license_key}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
                        {(l.user_name ?? "?").slice(0, 1)}
                      </div>
                      <span className="truncate">{l.user_name ?? "—"}</span>
                    </div>
                  </div>
                  <StatusBadge status={computeStatus(l)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="min-w-0 truncate">Vendedor: <span className="text-foreground/80">{l.sold_by ?? "—"}</span></div>
                  <div className="text-right tabular-nums">Disp.: <span className="text-foreground/80">{l.max_devices ?? 1}</span></div>
                  <div className="col-span-2 tabular-nums">Expira: <span className="text-foreground/80">{formatDate(l.expires_at)}</span></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-center gap-1.5 px-2 text-xs"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(l.license_key); toast.success("Copiado"); }
                      catch { toast.error("Falha ao copiar"); }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Copiar
                  </Button>
                  <EditLicenseDialog license={l} triggerLabel="Editar" triggerClassName="h-8 justify-center gap-1.5 px-2 text-xs" />
                  <ResetLicenseDialog
                    license={l}
                    resellerId={reseller.data!.id}
                    triggerLabel="Resetar"
                    triggerClassName="h-8 justify-center gap-1.5 px-2 text-xs"
                    invalidateKeys={[
                      ["reseller-licenses", reseller.data!.id],
                      ["licenses"],
                    ]}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 justify-center gap-1.5 px-2 text-xs"
                    disabled={l.status === "revoked" || revoke.isPending}
                    onClick={() => revoke.mutate(l.id)}
                    aria-label="Revogar"
                  >
                    <Ban className="h-4 w-4" aria-hidden />
                    Bloquear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="col-span-2 h-8 justify-center gap-1.5 px-2 text-xs text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm("Remover esta licença?")) remove.mutate(l.id);
                    }}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remover
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card sm:block">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Chave</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Cliente</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Vendedor</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Expira em</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Disp.</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Ações</TableHead>
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
                  <TableCell colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-border/60 bg-muted/40">
                        <KeyRound className="h-5 w-5 opacity-60" aria-hidden />
                      </div>
                      <p className="text-sm font-medium">Nenhuma licença encontrada</p>
                      <p className="text-xs">Crie sua primeira licença clicando em "Nova licença".</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id} className="text-sm border-border/40 transition-colors hover:bg-muted/40">
                    <TableCell className="py-3">
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 pl-2 pr-1 py-1 font-mono text-[11px]">
                        <KeyRound className="h-3 w-3 text-primary" aria-hidden />
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
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
                          {(l.user_name ?? "?").slice(0, 1)}
                        </div>
                        <span className="truncate">{l.user_name ?? "—"}</span>
                      </div>
                    </TableCell>
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
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDate(l.expires_at)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{l.max_devices ?? 1}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/60 p-0.5">
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
                          className="h-8 w-8 p-0"
                          disabled={l.status === "revoked" || revoke.isPending}
                          onClick={() => revoke.mutate(l.id)}
                          aria-label="Revogar"
                        >
                          <Ban className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function GradientStatCard({
  label, description, value, tone, percent, icon,
}: {
  label: string;
  description: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "rose";
  percent?: number;
  icon: React.ReactNode;
}) {
  const palette: Record<string, { chip: string; ring: string; stroke: string; glow: string }> = {
    primary: {
      chip: "bg-primary/15 text-primary border-primary/25",
      ring: "from-primary/25 via-primary/10 to-transparent",
      stroke: "stroke-primary",
      glow: "shadow-[0_20px_60px_-30px_color-mix(in_oklab,var(--primary)_70%,transparent)]",
    },
    emerald: {
      chip: "bg-emerald-500/15 text-emerald-500 border-emerald-500/25 dark:text-emerald-300",
      ring: "from-emerald-500/25 via-emerald-500/10 to-transparent",
      stroke: "stroke-emerald-500",
      glow: "shadow-[0_20px_60px_-30px_rgba(16,185,129,0.55)]",
    },
    amber: {
      chip: "bg-amber-500/15 text-amber-500 border-amber-500/25 dark:text-amber-300",
      ring: "from-amber-500/25 via-amber-500/10 to-transparent",
      stroke: "stroke-amber-500",
      glow: "shadow-[0_20px_60px_-30px_rgba(245,158,11,0.55)]",
    },
    rose: {
      chip: "bg-rose-500/15 text-rose-500 border-rose-500/25 dark:text-rose-300",
      ring: "from-rose-500/25 via-rose-500/10 to-transparent",
      stroke: "stroke-rose-500",
      glow: "shadow-[0_20px_60px_-30px_rgba(244,63,94,0.55)]",
    },
  };
  const p = palette[tone];
  return (
    <div className={`group relative min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card p-2 transition-all hover:border-border sm:rounded-2xl sm:p-4 ${p.glow}`}>
      <div className={`pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gradient-to-br ${p.ring} blur-2xl`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border [&_svg]:h-3.5 [&_svg]:w-3.5 sm:h-9 sm:w-9 sm:rounded-xl sm:[&_svg]:h-4 sm:[&_svg]:w-4 ${p.chip}`}>
          {icon}
        </div>
        {typeof percent === "number" ? (
          <span className={`rounded-full border px-1 py-0.5 text-[8px] font-semibold tabular-nums sm:px-2 sm:text-[10px] ${p.chip}`}>
            {percent}%
          </span>
        ) : null}
      </div>
      <div className="relative mt-2 sm:mt-3">
        <p className="truncate text-[9px] font-medium text-foreground/90 sm:text-[13px]">{label}</p>
        <p className="mt-0.5 text-lg font-bold tracking-tight tabular-nums leading-none sm:text-3xl">{value}</p>
        <p className="mt-1 hidden text-[10px] text-muted-foreground truncate sm:mt-2 sm:block sm:text-[11px]">{description}</p>
      </div>
      <Sparkline className={`relative mt-1 h-4 w-full sm:mt-3 sm:h-8 ${p.stroke}`} seed={label.length + value} />
    </div>
  );
}

function Sparkline({ className, seed }: { className?: string; seed: number }) {
  // Deterministic pseudo-random smooth path
  const points = Array.from({ length: 14 }, (_, i) => {
    const n = Math.sin((seed + 1) * (i + 1) * 1.7) * 0.5 + 0.5;
    const jitter = Math.sin((seed + 3) * (i + 2) * 0.9) * 0.15;
    return Math.max(0.05, Math.min(0.95, n * 0.7 + 0.15 + jitter));
  });
  const w = 200;
  const h = 40;
  const step = w / (points.length - 1);
  const d = points
    .map((y, i) => {
      const x = i * step;
      const cy = h - y * h;
      if (i === 0) return `M ${x} ${cy}`;
      const prevX = (i - 1) * step;
      const prevY = h - points[i - 1] * h;
      const cx1 = prevX + step / 2;
      const cx2 = x - step / 2;
      return `C ${cx1} ${prevY}, ${cx2} ${cy}, ${x} ${cy}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function MobileEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-8 text-center text-muted-foreground">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-dashed border-border/60 bg-muted/40">
        <KeyRound className="h-4 w-4 opacity-60" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed">{description}</p>
    </div>
  );
}

function QuotaBar({
  used, max, pct, remaining,
}: { used: number; max: number; pct: number; remaining: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 sm:rounded-2xl sm:p-4">
      <div className="grid gap-2.5 sm:flex sm:items-center sm:gap-4">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:shrink-0">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="truncate text-sm font-medium text-foreground/90">Cota de licenças</span>
          <span className="font-bold tabular-nums text-base sm:text-lg">{used}<span className="text-sm font-medium text-muted-foreground sm:text-base"> / {max}</span></span>
        </div>
        <div className="relative h-2 min-w-0 rounded-full bg-muted/60 overflow-hidden sm:flex-1 sm:min-w-[120px]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums sm:shrink-0 sm:text-xs">
          <span className="font-semibold text-foreground/80">{remaining}</span> restantes · {pct}% utilizado
        </div>
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
        <Button size="sm" className="h-9 w-full gap-1.5 px-2 text-xs sm:w-auto sm:gap-2 sm:px-3 sm:text-sm" disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          <span className="truncate">Nova licença</span>
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
          <div className="space-y-2">
            <Label htmlFor="uname">Cliente</Label>
            <Input id="uname" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do cliente" />
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


// ============================================================================
// LP Panel — chaves da segunda extensão (LP)
// ============================================================================
function LpPanel({
  resellerId,
  maxKeys,
  disabled,
}: {
  resellerId: string;
  maxKeys: number;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSecondLicensesByReseller);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["reseller-lp-licenses", resellerId],
    queryFn: () => listFn({ data: { reseller_id: resellerId } }),
  });

  const list = q.data ?? [];
  const paid = list.filter((l) => l.status !== "trial");
  const used = paid.length;
  const remaining = Math.max(0, maxKeys - used);
  const pct = maxKeys > 0 ? Math.min(100, Math.round((used / maxKeys) * 100)) : 0;
  const trials = list.length - paid.length;
  const active = list.filter((l) => l.status === "active").length;
  const expired = list.filter((l) => l.status === "expired").length;

  const filtered = list.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.license_key.toLowerCase().includes(s) ||
      (l.user_name ?? "").toLowerCase().includes(s) ||
      (l.sold_by ?? "").toLowerCase().includes(s)
    );
  });

  const revokeFn = useServerFn(revokeSecondLicense);
  const removeFn = useServerFn(deleteSecondLicense);

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Licença Lovpro revogada");
      qc.invalidateQueries({ queryKey: ["reseller-lp-licenses", resellerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Licença Lovpro removida");
      qc.invalidateQueries({ queryKey: ["reseller-lp-licenses", resellerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked = disabled || remaining <= 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <GradientStatCard
          label="Total Lovpro"
          description="Todas as licenças Lovpro"
          value={list.length}
          tone="primary"
          icon={<FileText className="h-4 w-4" aria-hidden />}
        />
        <GradientStatCard
          label="Ativas"
          description="Licenças Lovpro ativas"
          value={active}
          tone="emerald"
          percent={list.length > 0 ? Math.round((active / list.length) * 100) : 0}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
        />
        <GradientStatCard
          label="Trials"
          description="Lovpro em período de teste"
          value={trials}
          tone="amber"
          percent={list.length > 0 ? Math.round((trials / list.length) * 100) : 0}
          icon={<FlaskConical className="h-4 w-4" aria-hidden />}
        />
        <GradientStatCard
          label="Expiradas"
          description="Licenças Lovpro expiradas"
          value={expired}
          tone="rose"
          percent={list.length > 0 ? Math.round((expired / list.length) * 100) : 0}
          icon={<XCircle className="h-4 w-4" aria-hidden />}
        />
      </div>

      <QuotaBar used={used} max={maxKeys} pct={pct} remaining={remaining} />

      <div className="grid gap-2.5 sm:flex sm:items-center sm:gap-3">
        <div className="relative min-w-0 sm:flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar chave, cliente ou vendedor..."
            className="pl-8 h-9"
            aria-label="Buscar"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => qc.invalidateQueries({ queryKey: ["reseller-lp-licenses", resellerId] })}
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
          <NewLpLicenseDialog
            resellerId={resellerId}
            maxKeys={maxKeys}
            currentCount={used}
            disabled={disabled}
            quotaReached={remaining <= 0}
          />
        </div>
      </div>

      {blocked ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
          <div>
            <span className="font-medium text-destructive">Geração Lovpro bloqueada.</span>{" "}
            <span className="text-muted-foreground">
              {disabled ? "Revenda inativa." : "Cota Lovpro esgotada."}
            </span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 sm:hidden">
        {q.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : filtered.length === 0 ? (
          <MobileEmptyState title="Nenhuma licença Lovpro encontrada" description="Crie sua primeira licença Lovpro em Nova licença Lovpro." />
        ) : (
          filtered.map((l) => (
            <article key={l.id} className="rounded-xl border border-border/60 bg-card p-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate font-mono text-xs font-semibold">{l.license_key}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
                      {(l.user_name ?? "?").slice(0, 1)}
                    </div>
                    <span className="truncate">{l.user_name ?? "—"}</span>
                  </div>
                </div>
                <StatusBadge status={(l.status ?? "active") as "active" | "trial" | "expired" | "revoked"} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="min-w-0 truncate">Vendedor: <span className="text-foreground/80">{l.sold_by ?? "—"}</span></div>
                <div className="col-span-2 tabular-nums">Expira: <span className="text-foreground/80">{formatDate(l.expires_at)}</span></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 justify-center gap-1.5 px-2 text-xs"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(l.license_key); toast.success("Copiado"); }
                    catch { toast.error("Falha ao copiar"); }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Copiar
                </Button>
                <EditSecondLicenseDialog license={l} />
                <ResetSecondLicenseDialog license={l} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-center gap-1.5 px-2 text-xs"
                  disabled={l.status === "revoked" || revoke.isPending}
                  onClick={() => revoke.mutate(l.id)}
                  aria-label="Revogar"
                >
                  <Ban className="h-4 w-4" aria-hidden />
                  Bloquear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-center gap-1.5 px-2 text-xs text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm("Remover esta licença Lovpro?")) remove.mutate(l.id);
                  }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  Remover
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Chave Lovpro</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Cliente</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Vendedor</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Expira em</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-border/60 bg-muted/40">
                      <KeyRound className="h-5 w-5 opacity-60" aria-hidden />
                    </div>
                    <p className="text-sm font-medium">Nenhuma licença Lovpro encontrada</p>
                    <p className="text-xs">Crie sua primeira licença Lovpro clicando em "Nova licença Lovpro".</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id} className="text-sm border-border/40 transition-colors hover:bg-muted/40">
                  <TableCell className="py-3">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 pl-2 pr-1 py-1 font-mono text-[11px]">
                      <KeyRound className="h-3 w-3 text-primary" aria-hidden />
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
                  <TableCell className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
                        {(l.user_name ?? "?").slice(0, 1)}
                      </div>
                      <span className="truncate">{l.user_name ?? "—"}</span>
                    </div>
                  </TableCell>
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
                  <TableCell><StatusBadge status={(l.status ?? "active") as "active" | "trial" | "expired" | "revoked"} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDate(l.expires_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/60 p-0.5">
                      <EditSecondLicenseDialog license={l} iconOnly />
                      <ResetSecondLicenseDialog license={l} iconOnly />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={l.status === "revoked" || revoke.isPending}
                        onClick={() => revoke.mutate(l.id)}
                        aria-label="Revogar"
                      >
                        <Ban className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm("Remover esta licença Lovpro?")) remove.mutate(l.id);
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

function EditSecondLicenseDialog({ license, iconOnly = false }: { license: SecondLicense; iconOnly?: boolean }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSecondLicense);
  const [open, setOpen] = useState(false);
  const [licenseKey, setLicenseKey] = useState(license.license_key);
  const [userName, setUserName] = useState(license.user_name ?? "");
  const [status, setStatus] = useState<"active" | "trial" | "expired" | "revoked" | "paused" | "inactive">(
    (license.status ?? "active") as "active" | "trial" | "expired" | "revoked" | "paused" | "inactive",
  );
  const [maxDevices, setMaxDevices] = useState<number>(license.max_devices ?? 1);
  const [expiresAt, setExpiresAt] = useState<string>(license.expires_at ? toLocalInput(license.expires_at) : "");

  const save = useMutation({
    mutationFn: () => updateFn({
      data: {
        id: license.id,
        license_key: licenseKey.trim().toUpperCase(),
        user_name: userName || "Cliente",
        status,
        max_devices: maxDevices,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: status !== "revoked" && status !== "inactive" && status !== "paused",
      },
    }),
    onSuccess: () => {
      toast.success("Licença Lovpro atualizada");
      qc.invalidateQueries({ queryKey: ["reseller-lp-licenses"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setLicenseKey(license.license_key);
          setUserName(license.user_name ?? "");
          setStatus((license.status ?? "active") as "active" | "trial" | "expired" | "revoked" | "paused" | "inactive");
          setMaxDevices(license.max_devices ?? 1);
          setExpiresAt(license.expires_at ? toLocalInput(license.expires_at) : "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Editar" className={iconOnly ? "h-8 w-8 p-0" : "h-8 justify-center gap-1.5 px-2 text-xs"}>
          <Pencil className="h-4 w-4" aria-hidden />
          {iconOnly ? null : "Editar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar licença Lovpro</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{license.license_key}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="lp-edit-key">Key</Label>
            <div className="flex gap-2">
              <Input id="lp-edit-key" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value.toUpperCase())} className="font-mono" required />
              <Button type="button" variant="outline" size="sm" onClick={() => setLicenseKey(generateSecondLicenseKey())}>Gerar</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-edit-user">Cliente</Label>
            <Input id="lp-edit-user" value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lp-edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="lp-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="revoked">Revogada</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-edit-devices">Dispositivos</Label>
              <Input id="lp-edit-devices" type="number" min={1} value={maxDevices} onChange={(e) => setMaxDevices(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-edit-expiry">Expira em</Label>
            <div className="flex gap-2">
              <Input id="lp-edit-expiry" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={() => setExpiresAt("")}>Sem validade</Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetSecondLicenseDialog({ license, iconOnly = false }: { license: SecondLicense; iconOnly?: boolean }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSecondLicense);
  const [open, setOpen] = useState(false);
  const [clearDevice, setClearDevice] = useState(true);
  const [resetSession, setResetSession] = useState(true);
  const [renewExpiry, setRenewExpiry] = useState(false);
  const [reactivate, setReactivate] = useState(false);
  const canRenew = !!license.duration_minutes && license.duration_minutes > 0;
  const nothingSelected = !clearDevice && !resetSession && !renewExpiry && !reactivate;

  const reset = useMutation({
    mutationFn: () => {
      const data: {
        id: string;
        device_id?: string | null;
        activated_at?: string | null;
        session_id?: string | null;
        status?: "active";
        is_active?: boolean;
        expires_at?: string;
      } = { id: license.id };
      if (clearDevice) {
        data.device_id = null;
        data.activated_at = null;
      }
      if (resetSession) data.session_id = crypto.randomUUID();
      if (reactivate) {
        data.status = "active";
        data.is_active = true;
      }
      if (renewExpiry && canRenew) {
        data.expires_at = new Date(Date.now() + (license.duration_minutes ?? 0) * 60_000).toISOString();
      }
      return updateFn({ data });
    },
    onSuccess: () => {
      toast.success("Licença Lovpro resetada");
      qc.invalidateQueries({ queryKey: ["reseller-lp-licenses"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Resetar" className={iconOnly ? "h-8 w-8 p-0" : "h-8 justify-center gap-1.5 px-2 text-xs"}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {iconOnly ? null : "Resetar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resetar licença Lovpro</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{license.license_key}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input type="checkbox" checked={clearDevice} onChange={(e) => setClearDevice(e.target.checked)} className="mt-1" />
            <span className="text-sm">Limpar dispositivo vinculado</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input type="checkbox" checked={resetSession} onChange={(e) => setResetSession(e.target.checked)} className="mt-1" />
            <span className="text-sm">Zerar sessão</span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${canRenew ? "" : "opacity-50"}`}>
            <input type="checkbox" checked={renewExpiry && canRenew} disabled={!canRenew} onChange={(e) => setRenewExpiry(e.target.checked)} className="mt-1" />
            <span className="text-sm">Renovar validade</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input type="checkbox" checked={reactivate} onChange={(e) => setReactivate(e.target.checked)} className="mt-1" />
            <span className="text-sm">Reativar status</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => reset.mutate()} disabled={reset.isPending || nothingSelected}>{reset.isPending ? "Resetando..." : "Resetar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLpLicenseDialog({
  resellerId, maxKeys, currentCount, disabled, quotaReached,
}: { resellerId: string; maxKeys: number; currentCount: number; disabled: boolean; quotaReached: boolean }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createSecondLicense);
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState<"active" | "trial">("active");
  const [days, setDays] = useState<number>(30);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [key, setKey] = useState<string>("");

  useEffect(() => {
    if (open) setKey(generateSecondLicenseKey());
  }, [open]);

  const applyPreset = (
    nextStatus: "active" | "trial",
    value: number,
    u: "minutes" | "hours" | "days",
  ) => {
    setStatus(nextStatus);
    setUnit(u);
    setDays(value);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (status !== "trial" && currentCount >= maxKeys) {
        throw new Error("Cota Lovpro esgotada.");
      }
      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? days : unit === "hours" ? days * 60 : days * 24 * 60;
      const expires_at = days > 0 ? new Date(Date.now() + days * factor).toISOString() : null;
      await createFn({
        data: {
          license_key: key,
          user_name: userName || "Cliente",
          status,
          expires_at,
          max_devices: maxDevices,
          duration_minutes: days > 0 ? minutesTotal : null,
          reseller_id: resellerId,
        },
      });
    },
    onSuccess: () => {
      toast.success("Licença Lovpro criada");
      qc.invalidateQueries({ queryKey: ["reseller-lp-licenses", resellerId] });
      setOpen(false);
      setKey(generateSecondLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 w-full gap-1.5 px-2 text-xs sm:w-auto sm:gap-2 sm:px-3 sm:text-sm" disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          <span className="truncate">Nova licença Lovpro</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença Lovpro</DialogTitle>
          <DialogDescription>
            Cota Lovpro: {currentCount}/{maxKeys}. Trials são grátis e não consomem cota.
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
            <Label htmlFor="lpkey">Chave Lovpro</Label>
            <div className="flex gap-2">
              <Input
                id="lpkey"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="font-mono"
                required
              />
              <Button type="button" variant="outline" onClick={() => setKey(generateSecondLicenseKey())}>
                Gerar
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lpuname">Cliente</Label>
            <Input id="lpuname" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lpdev">Dispositivos</Label>
              <Input id="lpdev" type="number" min={1} value={maxDevices} onChange={(e) => setMaxDevices(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lpdays">Validade</Label>
              <Input id="lpdays" type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lpunit">Unidade</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
              <SelectTrigger id="lpunit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Use 0 para sem expiração.</p>
          {quotaReached && status !== "trial" ? (
            <p className="text-xs text-destructive">Cota Lovpro esgotada — só é possível gerar Trial.</p>
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
