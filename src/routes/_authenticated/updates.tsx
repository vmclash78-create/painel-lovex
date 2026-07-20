import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listExtensionUpdatesAdmin,
  saveExtensionUpdate,
  deleteExtensionUpdate,
  type ExtensionUpdate,
} from "@/lib/extension-updates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/updates")({
  head: () => ({ meta: [{ title: "Atualizações — Painel" }] }),
  component: UpdatesAdminPage,
});

function UpdatesAdminPage() {
  const list = useServerFn(listExtensionUpdatesAdmin);
  const q = useQuery({ queryKey: ["extension_updates", "admin"], queryFn: () => list() });

  const [editing, setEditing] = useState<ExtensionUpdate | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <Megaphone className="h-5 w-5 text-primary" aria-hidden />
            Atualizações da extensão
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Publique changelogs visíveis aos clientes no portal público.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" aria-hidden /> Nova
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-3">
          {(q.data ?? []).map((u) => (
            <Card key={u.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="truncate">{u.title}</span>
                    <Badge variant="outline">v{u.version}</Badge>
                    <Badge className={u.is_lovepro ? "bg-purple-500/15 text-purple-400 border-purple-500/20" : "bg-primary/15 text-primary border-primary/20"}>
                      {u.is_lovepro ? "LovePro" : "LoveX"}
                    </Badge>
                  </CardTitle>
                  {u.published_at && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Publicado {new Date(u.published_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(u); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <DeleteBtn id={u.id} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p>
              </CardContent>
            </Card>
          ))}
          {(q.data ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma atualização publicada ainda.
            </div>
          )}
        </div>
      )}

      <UpdateDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteExtensionUpdate);
  const m = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extension_updates"] });
      toast.success("Removido");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      {m.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
    </Button>
  );
}

function UpdateDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (o: boolean) => void; initial: ExtensionUpdate | null }) {
  const qc = useQueryClient();
  const save = useServerFn(saveExtensionUpdate);
  const [version, setVersion] = useState(initial?.version ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [isLovepro, setIsLovepro] = useState(initial?.is_lovepro ?? false);

  const m = useMutation({
    mutationFn: () => save({
      data: {
        id: initial?.id,
        version, title, body, is_lovepro: isLovepro,
        published_at: initial?.published_at ?? new Date().toISOString(),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extension_updates"] });
      toast.success("Salvo");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (o) {
        setVersion(initial?.version ?? "");
        setTitle(initial?.title ?? "");
        setBody(initial?.body ?? "");
        setIsLovepro(initial?.is_lovepro ?? false);
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar atualização" : "Nova atualização"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Versão</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2.1" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Switch checked={isLovepro} onCheckedChange={setIsLovepro} id="lp" />
                <Label htmlFor="lp" className="text-xs">É LovePro</Label>
              </div>
            </div>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novidades da versão" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="- Correções&#10;- Melhorias" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !version || !title}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}