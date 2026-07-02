import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listSecondLicenses,
  createSecondLicense,
  revokeSecondLicense,
  deleteSecondLicense,
  generateSecondLicenseKey,
  type SecondLicense,
} from "@/lib/second-licenses.functions";
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
import { Plus, Search, RefreshCw, Ban, Trash2, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/second-panel")({
  head: () => ({ meta: [{ title: "Painel LP" }] }),
  component: SecondPanelPage,
});

function SecondPanelPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSecondLicenses);
  const { data, isLoading } = useQuery({
    queryKey: ["second-licenses"],
    queryFn: () => listFn(),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const revokeFn = useServerFn(revokeSecondLicense);
  const deleteFn = useServerFn(deleteSecondLicense);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((l) => {
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        l.license_key.toLowerCase().includes(s) ||
        (l.user_name ?? "").toLowerCase().includes(s);
      const status = computeStatus(l);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Licença revogada");
      qc.invalidateQueries({ queryKey: ["second-licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Licença removida");
      qc.invalidateQueries({ queryKey: ["second-licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 sm:text-2xl">
            <Database className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" aria-hidden />
            Painel LP
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Chaves com prefixo <span className="font-mono">LP-</span> no banco secundário.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["second-licenses"] })}
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
          <NewSecondLicenseDialog />
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
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
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

function computeStatus(l: SecondLicense): string {
  if (l.status === "revoked") return "revoked";
  if (l.expires_at && new Date(l.expires_at) < new Date()) return "expired";
  return l.status ?? "active";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function NewSecondLicenseDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createSecondLicense);
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState<"active" | "trial" | "expired" | "revoked" | "paused" | "inactive">("active");
  const [amount, setAmount] = useState<number>(30);
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [key, setKey] = useState<string>(generateSecondLicenseKey());

  const create = useMutation({
    mutationFn: async () => {
      const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
      const minutesTotal =
        unit === "minutes" ? amount : unit === "hours" ? amount * 60 : amount * 24 * 60;
      const expires_at = amount > 0 ? new Date(Date.now() + amount * factor).toISOString() : null;
      await createFn({
        data: {
          license_key: key,
          user_name: userName || "Usuário",
          status,
          expires_at,
          max_devices: maxDevices,
          duration_minutes: amount > 0 ? minutesTotal : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Licença criada");
      qc.invalidateQueries({ queryKey: ["second-licenses"] });
      setOpen(false);
      setKey(generateSecondLicenseKey());
      setUserName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Nova licença LP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licença LP</DialogTitle>
          <DialogDescription>Gere uma chave no banco secundário.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="lp-key">Chave</Label>
            <div className="flex gap-2">
              <Input
                id="lp-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setKey(generateSecondLicenseKey())}>
                Gerar
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-user">Usuário</Label>
            <Input id="lp-user" value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lp-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="lp-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="revoked">Revogada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-dev">Dispositivos</Label>
              <Input
                id="lp-dev"
                type="number"
                min={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lp-amt">Duração</Label>
              <Input
                id="lp-amt"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-unit">Unidade</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                <SelectTrigger id="lp-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use duração 0 para chave sem validade.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}