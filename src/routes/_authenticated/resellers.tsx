import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase, type Reseller } from "@/integrations/external-supabase/client";
import {
  resellersQueryOptions,
  generateResellerToken,
  countResellerLicenses,
} from "@/lib/resellers";
import { licensesQueryOptions, rankSellers } from "@/lib/licenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, Trash2, Pencil, ExternalLink, RefreshCw, Trophy, Medal, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resellers")({
  head: () => ({ meta: [{ title: "Revendas" }] }),
  component: ResellersPage,
});

function ResellersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(resellersQueryOptions);
  const licenses = useQuery(licensesQueryOptions);
  const topSellers = (licenses.data ? rankSellers(licenses.data) : []).slice(0, 8);

  const counts = useQueries({
    queries: (data ?? []).map((r) => ({
      queryKey: ["reseller-count", r.id],
      queryFn: () => countResellerLicenses(r.id),
    })),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resellers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revenda removida");
      qc.invalidateQueries({ queryKey: ["resellers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revendas</h1>
          <p className="text-sm text-muted-foreground">
            Crie links com cota de keys pagas. Trials não contam para a cota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["resellers"] })}
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
          <ResellerDialog mode="create" />
        </div>
      </header>

      <GlobalSellersRanking rows={topSellers} />

      <Card>
        <CardContent className="py-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (data?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma revenda criada.
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.map((r, i) => {
                    const used = counts[i]?.data ?? 0;
                    const link = buildResellerLink(r.token);
                    const exhausted = used >= r.max_keys;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <span className={exhausted ? "text-destructive font-medium" : ""}>
                            {used} / {r.max_keys}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.active ? (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">Ativa</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs truncate max-w-[200px]">{link}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(link)}
                              aria-label="Copiar link"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                            <Button variant="ghost" size="sm" asChild aria-label="Abrir link">
                              <a href={link} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <ResellerDialog mode="edit" reseller={r} />
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={remove.isPending}
                              onClick={() => {
                                if (confirm("Remover esta revenda? Licenças geradas serão mantidas.")) {
                                  remove.mutate(r.id);
                                }
                              }}
                              aria-label="Remover"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function buildResellerLink(token: string) {
  if (typeof window === "undefined") return `/r/${token}`;
  return `${window.location.origin}/r/${token}`;
}

function GlobalSellersRanking({
  rows,
}: {
  rows: Array<{ seller: string; total: number; paid: number; trial: number }>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-[var(--gradient-surface)]">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Top vendedores (todas as revendas)</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Chaves vendidas
        </span>
      </div>
      <CardContent className="py-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Nenhum vendedor registrado. Preencha o campo &quot;Vendedor&quot; ao criar chaves para começar o ranking.
          </p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r, i) => {
              const tone =
                i === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : i === 1 ? "bg-slate-400/15 text-slate-500 border-slate-400/30"
                : i === 2 ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                : "bg-muted text-muted-foreground border-transparent";
              return (
                <li key={r.seller} className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card px-3 py-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${tone}`}>
                    {i < 3 ? <Medal className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.seller}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.paid} pagas · {r.trial} trials
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{r.total}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

function ResellerDialog({ mode, reseller }: { mode: "create" | "edit"; reseller?: Reseller }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(reseller?.name ?? "");
  const [maxKeys, setMaxKeys] = useState<number>(reseller?.max_keys ?? 10);
  const [token, setToken] = useState(reseller?.token ?? generateResellerToken());
  const [active, setActive] = useState<boolean>(reseller?.active ?? true);
  const [password, setPassword] = useState<string>(reseller?.password ?? "");
  const [sellsMain, setSellsMain] = useState<boolean>(reseller?.sells_main ?? true);
  const [sellsLp, setSellsLp] = useState<boolean>(reseller?.sells_lp ?? false);
  const [maxKeysLp, setMaxKeysLp] = useState<number>(reseller?.max_keys_lp ?? 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!password || password.length < 4) {
        throw new Error("Defina uma senha de acesso (mínimo 4 caracteres).");
      }
      if (!sellsMain && !sellsLp) {
        throw new Error("Selecione ao menos um produto (Main ou LP).");
      }
      if (mode === "create") {
        const { error } = await supabase.from("resellers").insert({
          name: name || "Revenda",
          max_keys: maxKeys,
          token,
          active,
          password,
          sells_main: sellsMain,
          sells_lp: sellsLp,
          max_keys_lp: maxKeysLp,
        });
        if (error) throw error;
      } else if (reseller) {
        const { error } = await supabase
          .from("resellers")
          .update({
            name,
            max_keys: maxKeys,
            token,
            active,
            password,
            sells_main: sellsMain,
            sells_lp: sellsLp,
            max_keys_lp: maxKeysLp,
          })
          .eq("id", reseller.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Revenda criada" : "Revenda atualizada");
      qc.invalidateQueries({ queryKey: ["resellers"] });
      setOpen(false);
      if (mode === "create") {
        setName("");
        setMaxKeys(10);
        setToken(generateResellerToken());
        setPassword("");
        setSellsMain(true);
        setSellsLp(false);
        setMaxKeysLp(0);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && reseller) {
          setName(reseller.name);
          setMaxKeys(reseller.max_keys);
          setToken(reseller.token);
          setActive(reseller.active);
          setPassword(reseller.password ?? "");
          setSellsMain(reseller.sells_main ?? true);
          setSellsLp(reseller.sells_lp ?? false);
          setMaxKeysLp(reseller.max_keys_lp ?? 0);
        }
      }}
    >
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Nova revenda
          </Button>
        ) : (
          <Button variant="ghost" size="sm" aria-label="Editar">
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova revenda" : "Editar revenda"}</DialogTitle>
          <DialogDescription>Defina o nome, cota e link de acesso.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rname">Nome</Label>
            <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">Produtos que a revenda pode vender</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-2 rounded-md border p-2.5 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Main</p>
                  <p className="text-[11px] text-muted-foreground">Extensão principal</p>
                </div>
                <Switch checked={sellsMain} onCheckedChange={setSellsMain} aria-label="Vende Main" />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-2.5 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium">LP</p>
                  <p className="text-[11px] text-muted-foreground">Extensão LP (chaves LP-…)</p>
                </div>
                <Switch checked={sellsLp} onCheckedChange={setSellsLp} aria-label="Vende LP" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rmax">Cota Main</Label>
              <Input
                id="rmax"
                type="number"
                min={0}
                value={maxKeys}
                disabled={!sellsMain}
                onChange={(e) => setMaxKeys(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rmaxlp">Cota LP</Label>
              <Input
                id="rmaxlp"
                type="number"
                min={0}
                value={maxKeysLp}
                disabled={!sellsLp}
                onChange={(e) => setMaxKeysLp(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
              <Label htmlFor="rtoken">Token do link</Label>
              <div className="flex gap-1">
                <Input
                  id="rtoken"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                  className="font-mono"
                  required
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setToken(generateResellerToken())}>
                  Gerar
                </Button>
              </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="ractive" className="font-medium">Revenda ativa</Label>
              <p className="text-xs text-muted-foreground">Quando inativa, o link bloqueia novas keys.</p>
            </div>
            <Switch id="ractive" checked={active} onCheckedChange={setActive} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpass">Senha de acesso do cliente</Label>
            <Input
              id="rpass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha que o revendedor usará no link"
              required
              minLength={4}
            />
            <p className="text-xs text-muted-foreground">
              O cliente precisará informar esta senha ao abrir o link da revenda.
            </p>
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