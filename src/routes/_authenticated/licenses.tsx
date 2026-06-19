import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase, type License } from "@/integrations/supabase/client";
import { licensesQueryOptions, computeStatus, generateLicenseKey } from "@/lib/licenses";
import { StatusBadge } from "./dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, RefreshCw, Ban, Trash2, Pencil, Monitor, RotateCcw } from "lucide-react";
import { ResetLicenseDialog } from "@/components/reset-license-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/licenses")({
  head: () => ({ meta: [{ title: "Licenças" }] }),
  component: LicensesPage,
});

function LicensesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(licensesQueryOptions);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((l) => {
      const matchSearch =
        !search ||
        l.license_key.toLowerCase().includes(search.toLowerCase()) ||
        (l.user_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || computeStatus(l) === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença revogada");
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença removida");
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenças</h1>
          <p className="text-sm text-muted-foreground">Gerencie chaves, validade e dispositivos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["licenses"] })}
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
          <NewLicenseDialog />
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por chave ou usuário..."
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
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Dispositivos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                      <TableCell className="font-mono text-xs">{l.license_key}</TableCell>
                      <TableCell>{l.user_name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={computeStatus(l)} /></TableCell>
                      <TableCell className="text-sm">{formatDate(l.expires_at)}</TableCell>
                      <TableCell className="text-sm">{l.max_devices ?? 1}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditLicenseDialog license={l} />
                          <ResetLicenseDialog
                            license={l}
                            invalidateKeys={[["licenses"], ["reseller-licenses"]]}
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
    </section>
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

export function EditLicenseDialog({ license }: { license: License }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState(license.user_name ?? "");
  const [status, setStatus] = useState<NonNullable<License["status"]>>(license.status ?? "active");
  const [maxDevices, setMaxDevices] = useState<number>(license.max_devices ?? 1);
  const [expiresAt, setExpiresAt] = useState<string>(
    license.expires_at ? toLocalInput(license.expires_at) : "",
  );
  const [clearDevice, setClearDevice] = useState(false);
  const [resetSession, setResetSession] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        user_name: userName || "Usuário",
        status,
        max_devices: maxDevices,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (clearDevice) {
        patch.device_id = null;
        patch.activated_at = null;
      }
      if (resetSession) {
        patch.session_id = crypto.randomUUID();
      }
      const { error } = await supabase.from("licenses").update(patch).eq("id", license.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença atualizada");
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["reseller-licenses"] });
      setOpen(false);
      setClearDevice(false);
      setResetSession(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setUserName(license.user_name ?? "");
          setStatus(license.status ?? "active");
          setMaxDevices(license.max_devices ?? 1);
          setExpiresAt(license.expires_at ? toLocalInput(license.expires_at) : "");
          setClearDevice(false);
          setResetSession(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Editar">
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar licença</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{license.license_key}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="euname">Usuário</Label>
            <Input id="euname" value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="estatus">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="estatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="revoked">Revogada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edev">Dispositivos</Label>
              <Input
                id="edev"
                type="number"
                min={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eexp">Expira em</Label>
            <div className="flex gap-2">
              <Input
                id="eexp"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setExpiresAt("")}>
                Sem validade
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ações rápidas</p>
            <div className="text-xs text-muted-foreground">
              Dispositivo atual: <span className="font-mono">{license.device_id ?? "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={clearDevice ? "default" : "outline"}
                size="sm"
                onClick={() => setClearDevice((v) => !v)}
                className="gap-2"
              >
                <Monitor className="h-4 w-4" aria-hidden />
                {clearDevice ? "Vai limpar dispositivo" : "Limpar dispositivo"}
              </Button>
              <Button
                type="button"
                variant={resetSession ? "default" : "outline"}
                size="sm"
                onClick={() => setResetSession((v) => !v)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                {resetSession ? "Vai zerar sessão" : "Zerar sessão"}
              </Button>
              <Button
                type="button"
                variant={status === "revoked" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setStatus("revoked")}
                className="gap-2"
              >
                <Ban className="h-4 w-4" aria-hidden />
                Revogar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewLicenseDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState<NonNullable<License["status"]>>("active");
  const [days, setDays] = useState<number>(30);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [key, setKey] = useState<string>(generateLicenseKey());

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

  const create = useMutation({
    mutationFn: async () => {
      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? days : unit === "hours" ? days * 60 : days * 24 * 60;
      if (status === "trial" && (minutesTotal <= 0 || minutesTotal > 15)) {
        throw new Error("Trial: máximo 15 minutos.");
      }
      const expires_at = days > 0 ? new Date(Date.now() + days * factor).toISOString() : null;
      const { error } = await supabase.from("licenses").insert({
        license_key: key,
        user_name: userName || "Usuário",
        status,
        expires_at,
        max_devices: maxDevices,
        duration_minutes: days > 0 ? minutesTotal : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença criada");
      qc.invalidateQueries({ queryKey: ["licenses"] });
      setOpen(false);
      setKey(generateLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Nova licença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
          <DialogDescription>Gere uma nova chave de licença.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
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
              <Input id="lkey" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} className="font-mono" required />
              <Button type="button" variant="outline" onClick={() => setKey(generateLicenseKey())}>
                Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Formato: AA-12345678-ABCDEF01</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="uname">Usuário</Label>
            <Input id="uname" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do usuário" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lstatus">Status</Label>
              <Select value={status} onValueChange={(v) => updateStatus(v as typeof status)}>
                <SelectTrigger id="lstatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="revoked">Revogada</SelectItem>
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
          <p className="text-xs text-muted-foreground">Use 0 para sem expiração. Trial = chave com tempo limitado.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}