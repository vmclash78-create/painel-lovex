import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/supabase/client";
import { fetchResellerByToken, fetchResellerLicenses } from "@/lib/resellers";
import { computeStatus, generateLicenseKey } from "@/lib/licenses";
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
import {
  KeyRound, Plus, Search, RefreshCw, Ban, Trash2, ShieldAlert, Loader2, Copy,
  Sparkles, CheckCircle2, Clock, XCircle, Sun, Moon, Sunset,
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
      {/* Hero header */}
      <header className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 gradient-primary opacity-90" aria-hidden />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.18), transparent 45%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-primary-foreground/90 text-sm font-medium">
              <KeyRound className="h-4 w-4" aria-hidden />
              <span>Painel de Revenda</span>
            </div>
            {reseller.data.active ? (
              <Badge className="bg-white/15 text-primary-foreground border-white/20 backdrop-blur-sm gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Ativa
              </Badge>
            ) : (
              <Badge className="bg-destructive/80 text-destructive-foreground border-destructive/40">Inativa</Badge>
            )}
          </div>
          <div className="mt-6 flex items-center gap-3 text-primary-foreground/80">
            <GreetingIcon />
            <span className="text-sm sm:text-base">{getGreeting()},</span>
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground">
            {reseller.data.name}
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/80 max-w-xl">
            Gere, gerencie e acompanhe suas licenças com facilidade.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total de keys"
            value={totalCount}
            icon={<KeyRound className="h-4 w-4" />}
            tone="primary"
          />
          <StatCard
            label="Ativas"
            value={activeCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="emerald"
          />
          <StatCard
            label="Trials"
            value={trialCount}
            icon={<Sparkles className="h-4 w-4" />}
            tone="amber"
            hint="Não contam na cota"
          />
          <StatCard
            label="Expiradas"
            value={expiredCount}
            icon={<XCircle className="h-4 w-4" />}
            tone="rose"
          />
        </div>

        {/* Quota card */}
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Sua cota</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={"text-3xl font-bold tracking-tight " + (remaining === 0 ? "text-destructive" : "text-foreground")}>
                    {used}
                  </span>
                  <span className="text-lg text-muted-foreground">/ {max}</span>
                  <span className="text-sm text-muted-foreground">keys</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Restantes</p>
                <p className={"text-2xl font-semibold " + (remaining === 0 ? "text-destructive" : "text-primary")}>
                  {remaining}
                </p>
              </div>
            </div>
            <div className="relative">
              <Progress value={pct} aria-label="Uso da cota" className="h-2.5" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                Trials são gratuitas e não contam na cota.
              </span>
              <span>{pct}% utilizado</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Licenças</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
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
          </div>
        </div>

        {blocked ? (
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" aria-hidden />
            <div>
              <p className="font-medium text-destructive">Geração bloqueada</p>
              <p className="text-muted-foreground">
                {!reseller.data.active
                  ? "Esta revenda está inativa. Contate o administrador."
                  : "Cota esgotada. Solicite mais keys ao administrador."}
              </p>
            </div>
          </div>
        ) : null}

        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por chave ou cliente..."
                  className="pl-8"
                  aria-label="Buscar"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filtrar por status">
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
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma licença encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((l) => (
                      <TableRow key={l.id}>
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
                        <TableCell className="text-sm">{formatDate(l.expires_at)}</TableCell>
                        <TableCell className="text-sm">{l.max_devices ?? 1}</TableCell>
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
          </CardContent>
        </Card>
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

function GreetingIcon() {
  const h = new Date().getHours();
  const cls = "h-4 w-4";
  if (h < 12) return <Sun className={cls} aria-hidden />;
  if (h < 18) return <Sunset className={cls} aria-hidden />;
  return <Moon className={cls} aria-hidden />;
}

function StatCard({
  label, value, icon, tone, hint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "emerald" | "amber" | "rose";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={"grid h-9 w-9 place-items-center rounded-lg " + tones[tone]}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold tracking-tight leading-tight">{value}</p>
          {hint ? <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
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

  // Generate a fresh key each time the dialog opens (avoids SSR-cached value).
  useEffect(() => {
    if (open) setKey(generateLicenseKey());
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      // Re-check quota at insert time — trials don't count
      if (status !== "trial") {
        const { count, error: cErr } = await supabase
          .from("licenses")
          .select("id", { count: "exact", head: true })
          .eq("reseller_id", resellerId)
          .neq("status", "trial")
          .or("duration_minutes.is.null,duration_minutes.gt.15");
        if (cErr) throw cErr;
        if ((count ?? 0) >= maxKeys) throw new Error("Cota esgotada.");
      }

      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? days : unit === "hours" ? days * 60 : days * 24 * 60;
      if (status === "trial" && (minutesTotal <= 0 || minutesTotal > 15)) {
        throw new Error("Trial: máximo 15 minutos.");
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
      setOpen(false);
      setKey(generateLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova licença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
          <DialogDescription>
            Cota: {currentCount}/{maxKeys}. A chave será vinculada à sua revenda.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => { updateStatus("trial"); setDays(5); setMaxDevices(1); }}>
              Trial 5 min
            </Button>
            <Button type="button" variant="outline" size="sm"
              onClick={() => { updateStatus("trial"); setDays(10); setMaxDevices(1); }}>
              Trial 10 min
            </Button>
            <Button type="button" variant="outline" size="sm"
              onClick={() => { updateStatus("trial"); setDays(15); setMaxDevices(1); }}>
              Trial 15 min
            </Button>
          </div>
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