import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, type License } from "@/integrations/supabase/client";
import { fetchResellerByToken, fetchResellerLicenses } from "@/lib/resellers";
import { computeStatus, generateLicenseKey } from "@/lib/licenses";
import {
  getResellerBalance, listPurchases, listKeyTransactions,
  createPixPurchase, checkPurchaseStatus, consumeKey, KEY_PACKAGES,
} from "@/lib/reseller-billing.functions";
import { StatusBadge } from "./_authenticated/dashboard";
import { EditLicenseDialog } from "./_authenticated/licenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  KeyRound, Plus, Search, RefreshCw, Ban, Trash2, ShieldAlert, Loader2, Copy,
  Activity, Wallet, ShoppingCart, History, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
} from "lucide-react";
import { ResetLicenseDialog } from "@/components/reset-license-dialog";
import { toast } from "sonner";

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

  const isTrialLicense = (l: License) =>
    l.status === "trial" ||
    (l.duration_minutes != null && l.duration_minutes > 0 && l.duration_minutes <= 15);
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

  // ====== Billing (saldo de keys, compras, extrato) ======
  const password = reseller.data?.password ?? "";
  const billingArgs = { token, password };

  const getBalanceFn = useServerFn(getResellerBalance);
  const listPurchasesFn = useServerFn(listPurchases);
  const listTxFn = useServerFn(listKeyTransactions);

  const balanceQ = useQuery({
    queryKey: ["reseller-balance", token],
    queryFn: () => getBalanceFn({ data: billingArgs }),
    enabled: authed && !!reseller.data,
    refetchInterval: 15_000,
  });
  const purchasesQ = useQuery({
    queryKey: ["reseller-purchases", token],
    queryFn: () => listPurchasesFn({ data: billingArgs }),
    enabled: authed && !!reseller.data,
  });
  const txQ = useQuery({
    queryKey: ["reseller-tx", token],
    queryFn: () => listTxFn({ data: billingArgs }),
    enabled: authed && !!reseller.data,
  });

  const balance = balanceQ.data?.balance ?? 0;
  const noBalance = balance <= 0;

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
        {/* Saldo de Keys + stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="col-span-2 lg:col-span-1 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 p-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-primary/80">Saldo de Keys</p>
              <p className="text-xl font-bold tracking-tight leading-tight tabular-nums">
                {balanceQ.isLoading ? "—" : balance}
              </p>
            </div>
          </div>
          <CompactStat label="Total" value={totalCount} tone="primary" />
          <CompactStat label="Ativas" value={activeCount} tone="emerald" />
          <CompactStat label="Trials" value={trialCount} tone="amber" />
          <CompactStat label="Expiradas" value={expiredCount} tone="rose" />
        </div>

        <Tabs defaultValue="licenses" className="space-y-4">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="licenses" className="gap-1.5"><KeyRound className="h-3.5 w-3.5" />Licenças</TabsTrigger>
            <TabsTrigger value="buy" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />Comprar Keys</TabsTrigger>
            <TabsTrigger value="purchases" className="gap-1.5"><History className="h-3.5 w-3.5" />Histórico</TabsTrigger>
            <TabsTrigger value="extract" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Extrato</TabsTrigger>
          </TabsList>

          <TabsContent value="licenses" className="space-y-4">
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
              token={token}
              password={password}
              balance={balance}
              disabled={!reseller.data.active}
              quotaReached={noBalance}
            />
          </div>
        </div>

        {!reseller.data.active || noBalance ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div>
              <span className="font-medium text-destructive">Geração bloqueada.</span>{" "}
              <span className="text-muted-foreground">
                {!reseller.data.active
                  ? "Revenda inativa. Contate o administrador."
                  : "Saldo zerado. Compre keys na aba \"Comprar Keys\"."}
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
                    <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
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
          </TabsContent>

          <TabsContent value="buy">
            <BuyKeysTab token={token} password={password} />
          </TabsContent>

          <TabsContent value="purchases">
            <PurchasesHistoryTab
              token={token}
              password={password}
              rows={purchasesQ.data ?? []}
              loading={purchasesQ.isLoading}
            />
          </TabsContent>

          <TabsContent value="extract">
            <ExtractTab rows={txQ.data ?? []} loading={txQ.isLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
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
  resellerId, token, password, balance, disabled, quotaReached,
}: { resellerId: string; token: string; password: string; balance: number; disabled: boolean; quotaReached: boolean }) {
  const qc = useQueryClient();
  const consumeFn = useServerFn(consumeKey);
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState<NonNullable<License["status"]>>("active");
  const [days, setDays] = useState<number>(30);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [key, setKey] = useState<string>("");

  const updateStatus = (nextStatus: NonNullable<License["status"]>) => {
    setStatus(nextStatus);
    if (nextStatus === "trial") {
      setUnit("minutes");
      setDays((value) => Math.min(Math.max(value || 15, 1), 15));
    }
  };

  const updateUnit = (nextUnit: "minutes" | "hours" | "days") => {
    setUnit(nextUnit);
    if (status === "trial") {
      setDays(15);
    }
  };

  useEffect(() => {
    if (open) setKey(generateLicenseKey());
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? days : unit === "hours" ? days * 60 : days * 24 * 60;
      if (status === "trial" && (minutesTotal <= 0 || minutesTotal > 15)) {
        throw new Error("Trial: máximo 15 minutos.");
      }
      // Consome 1 key do saldo apenas para licenças normais (não-trial)
      if (status !== "trial") {
        await consumeFn({ data: { token, password, description: `Licença ${key}` } });
      }
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
      qc.invalidateQueries({ queryKey: ["reseller-balance", token] });
      qc.invalidateQueries({ queryKey: ["reseller-tx", token] });
      setOpen(false);
      setKey(generateLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 h-9" disabled={disabled} title={quotaReached ? "Saldo zerado — compre keys" : undefined}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova licença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
          <DialogDescription>
            Saldo disponível: <span className="font-semibold text-primary">{balance} keys</span>. Cada licença normal consome 1 key. Trials não consomem.
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
                onClick={() => { updateStatus("active"); setUnit("days"); setDays(30); }}
              >
                Normal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={status === "trial" ? "default" : "ghost"}
                onClick={() => { updateStatus("trial"); setUnit("minutes"); setDays(15); setMaxDevices(1); }}
              >
                Trial (grátis)
              </Button>
            </div>
          </div>
          {status === "trial" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm"
                onClick={() => { updateStatus("trial"); setUnit("minutes"); setDays(5); setMaxDevices(1); }}>
                Trial 5 min
              </Button>
              <Button type="button" variant="outline" size="sm"
                onClick={() => { updateStatus("trial"); setUnit("minutes"); setDays(10); setMaxDevices(1); }}>
                Trial 10 min
              </Button>
              <Button type="button" variant="outline" size="sm"
                onClick={() => { updateStatus("trial"); setUnit("minutes"); setDays(15); setMaxDevices(1); }}>
                Trial 15 min
              </Button>
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
              <Select value={status} onValueChange={(v) => updateStatus(v as typeof status)}>
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
              <Input id="ldays" type="number" min={0} max={status === "trial" ? 15 : undefined} value={days} onChange={(e) => setDays(status === "trial" ? Math.min(Number(e.target.value), 15) : Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunit">Unidade</Label>
              <Select value={unit} onValueChange={(v) => updateUnit(v as typeof unit)}>
                <SelectTrigger id="lunit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  {status !== "trial" ? <SelectItem value="hours">Horas</SelectItem> : null}
                  {status !== "trial" ? <SelectItem value="days">Dias</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Use 0 para sem expiração. Trial máx. 15 minutos. Trials são gratuitas e não consomem cota.</p>
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

// ====================== BUY KEYS ======================
function BuyKeysTab({ token, password }: { token: string; password: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPixPurchase);
  const [pending, setPending] = useState<string | null>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixPurchase, setPixPurchase] = useState<any>(null);

  const buy = useMutation({
    mutationFn: async (packageId: string) => {
      setPending(packageId);
      return await createFn({ data: { token, password, packageId } });
    },
    onSuccess: (p) => {
      setPixPurchase(p);
      setPixOpen(true);
      qc.invalidateQueries({ queryKey: ["reseller-purchases", token] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Comprar Keys</h2>
        <p className="text-sm text-muted-foreground">Selecione um pacote. O pagamento via PIX é confirmado automaticamente.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KEY_PACKAGES.map((pkg) => {
          const unit = pkg.amount / pkg.quantity;
          const isBest = pkg.id === "p7" || pkg.id === "p8";
          return (
            <div
              key={pkg.id}
              className={`relative rounded-xl border bg-card p-4 transition hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 ${isBest ? "border-primary/40" : "border-border/60"}`}
            >
              {isBest ? (
                <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground">Melhor valor</Badge>
              ) : null}
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{pkg.name}</p>
                <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{pkg.quantity}<span className="text-sm font-medium text-muted-foreground"> keys</span></p>
              <p className="mt-1 text-2xl font-semibold text-primary">R$ {pkg.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-0.5">R$ {unit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por key</p>
              <Button
                className="mt-4 w-full gap-2"
                onClick={() => buy.mutate(pkg.id)}
                disabled={buy.isPending}
              >
                {pending === pkg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Comprar
              </Button>
            </div>
          );
        })}
      </div>
      <PixPaymentDialog
        open={pixOpen}
        onOpenChange={setPixOpen}
        purchase={pixPurchase}
        token={token}
        password={password}
      />
    </div>
  );
}

// ====================== PIX PAYMENT DIALOG ======================
function PixPaymentDialog({
  open, onOpenChange, purchase, token, password,
}: { open: boolean; onOpenChange: (v: boolean) => void; purchase: any; token: string; password: string }) {
  const qc = useQueryClient();
  const checkFn = useServerFn(checkPurchaseStatus);
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    if (!open || !purchase?.id) return;
    setStatus(purchase.status ?? "pending");
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await checkFn({ data: { token, password, purchaseId: purchase.id } });
        if (cancelled) return;
        setStatus(r.status);
        if (r.status === "paid") {
          toast.success("Pagamento confirmado! Keys creditadas.");
          qc.invalidateQueries({ queryKey: ["reseller-balance", token] });
          qc.invalidateQueries({ queryKey: ["reseller-purchases", token] });
          qc.invalidateQueries({ queryKey: ["reseller-tx", token] });
        }
      } catch { /* ignore */ }
    };
    tick();
    const interval = setInterval(() => {
      if (status !== "pending") return;
      tick();
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, purchase?.id]);

  if (!purchase) return null;
  const isPaid = status === "paid";
  const isFinal = status === "cancelled" || status === "expired";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPaid ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clock className="h-5 w-5 text-primary" />}
            {isPaid ? "Pagamento aprovado" : "Pague via PIX"}
          </DialogTitle>
          <DialogDescription>
            {purchase.package_name} · {purchase.quantity} keys · R$ {Number(purchase.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </DialogDescription>
        </DialogHeader>
        {isPaid ? (
          <div className="py-6 text-center space-y-2">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="font-medium">+{purchase.quantity} keys creditadas no seu saldo.</p>
          </div>
        ) : isFinal ? (
          <div className="py-6 text-center text-sm text-destructive">Pagamento {status === "expired" ? "expirado" : "cancelado"}.</div>
        ) : (
          <div className="space-y-3">
            {purchase.qr_code_base64 ? (
              <div className="rounded-lg bg-white p-3 mx-auto w-fit">
                <img
                  src={`data:image/png;base64,${purchase.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="h-56 w-56"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={purchase.pix_copy_paste ?? purchase.qr_code ?? ""}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(purchase.pix_copy_paste ?? purchase.qr_code ?? "");
                      toast.success("Código copiado");
                    } catch { toast.error("Falha ao copiar"); }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aguardando confirmação do pagamento…
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====================== PURCHASES HISTORY ======================
function PurchasesHistoryTab({
  token, password, rows, loading,
}: { token: string; password: string; rows: any[]; loading: boolean }) {
  const [filter, setFilter] = useState<string>("all");
  const [pixOpen, setPixOpen] = useState(false);
  const [pixPurchase, setPixPurchase] = useState<any>(null);

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Histórico de Compras</h2>
          <p className="text-sm text-muted-foreground">Todas as cobranças PIX geradas.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Pacote</TableHead>
              <TableHead className="text-xs">Qtd</TableHead>
              <TableHead className="text-xs">Valor</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Transação</TableHead>
              <TableHead className="text-right text-xs">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">Sem compras.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className="text-sm">
                <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                <TableCell>{r.package_name}</TableCell>
                <TableCell className="tabular-nums">{r.quantity}</TableCell>
                <TableCell className="tabular-nums">R$ {Number(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><PurchaseStatusBadge status={r.status} /></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.mercadopago_payment_id ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => { setPixPurchase(r); setPixOpen(true); }}>
                      Ver PIX
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PixPaymentDialog
        open={pixOpen}
        onOpenChange={setPixOpen}
        purchase={pixPurchase}
        token={token}
        password={password}
      />
    </div>
  );
}

function PurchaseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    pending: { label: "Aguardando", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    cancelled: { label: "Cancelado", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
    expired: { label: "Expirado", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

// ====================== EXTRACT ======================
function ExtractTab({ rows, loading }: { rows: any[]; loading: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Extrato de Keys</h2>
        <p className="text-sm text-muted-foreground">Todas as movimentações do seu saldo.</p>
      </div>
      <div className="rounded-md border divide-y divide-border/60">
        {loading ? (
          <div className="p-3"><Skeleton className="h-5 w-full" /></div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Sem movimentações.</div>
        ) : rows.map((r) => {
          const positive = r.quantity > 0;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className={`grid h-8 w-8 place-items-center rounded-md ${positive ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
                {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.description ?? r.type}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                {positive ? "+" : ""}{r.quantity} keys
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
