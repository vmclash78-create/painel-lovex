import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/supabase/client";
import {
  fetchResellerByToken,
  fetchResellerLicenses,
} from "@/lib/resellers";
import { generateLicenseKey } from "@/lib/licenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Copy, ShieldAlert, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/r/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel de Revenda" }] }),
  component: ResellerPublicPage,
});

function ResellerPublicPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const reseller = useQuery({
    queryKey: ["reseller", token],
    queryFn: () => fetchResellerByToken(token),
  });

  const licenses = useQuery({
    queryKey: ["reseller-licenses", reseller.data?.id],
    queryFn: () => fetchResellerLicenses(reseller.data!.id),
    enabled: !!reseller.data?.id,
  });

  const [userName, setUserName] = useState("");
  const [days, setDays] = useState<number>(30);

  const used = licenses.data?.length ?? 0;
  const max = reseller.data?.max_keys ?? 0;
  const remaining = Math.max(0, max - used);
  const blocked = !reseller.data?.active || remaining <= 0;

  const generate = useMutation({
    mutationFn: async () => {
      if (!reseller.data) throw new Error("Revenda não encontrada");
      // Re-check current count atomically-ish before insert
      const { count, error: cErr } = await supabase
        .from("licenses")
        .select("id", { count: "exact", head: true })
        .eq("reseller_id", reseller.data.id);
      if (cErr) throw cErr;
      if ((count ?? 0) >= reseller.data.max_keys) {
        throw new Error("Cota esgotada. Contate o administrador.");
      }
      if (!reseller.data.active) throw new Error("Revenda inativa.");

      const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const { error } = await supabase.from("licenses").insert({
        license_key: generateLicenseKey(),
        user_name: userName || "Cliente",
        status: "active",
        expires_at,
        max_devices: 1,
        duration_minutes: days > 0 ? days * 24 * 60 : null,
        reseller_id: reseller.data.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Key gerada");
      setUserName("");
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

  if (!reseller.data) {
    throw notFound();
  }

  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
            <span>Painel de Revenda</span>
          </div>
          {reseller.data.active ? (
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">Ativa</Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/20">Inativa</Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{reseller.data.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Keys geradas</span>
              <span className={remaining === 0 ? "font-semibold text-destructive" : "font-semibold"}>
                {used} / {max}
              </span>
            </div>
            <Progress value={pct} aria-label="Uso da cota" />
            <p className="text-xs text-muted-foreground">
              {remaining > 0
                ? `${remaining} key${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`
                : "Você atingiu o limite da sua cota."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gerar nova key</CardTitle>
          </CardHeader>
          <CardContent>
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
            ) : (
              <form
                className="grid gap-3 sm:grid-cols-[1fr_120px_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  generate.mutate();
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="cli">Cliente</Label>
                  <Input
                    id="cli"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dys">Validade (dias)</Label>
                  <Input
                    id="dys"
                    type="number"
                    min={0}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={generate.isPending} className="gap-2 w-full">
                    <Plus className="h-4 w-4" aria-hidden />
                    {generate.isPending ? "Gerando..." : "Gerar"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keys geradas</CardTitle>
          </CardHeader>
          <CardContent>
            {licenses.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (licenses.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma key gerada ainda.</p>
            ) : (
              <ul className="divide-y">
                {licenses.data!.map((l) => (
                  <LicenseRow key={l.id} license={l} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function LicenseRow({ license }: { license: License }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm">{license.license_key}</div>
        <div className="truncate text-xs text-muted-foreground">
          {license.user_name ?? "—"}
          {license.expires_at ? ` · expira ${new Date(license.expires_at).toLocaleDateString("pt-BR")}` : ""}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Copiar"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(license.license_key);
            toast.success("Chave copiada");
          } catch {
            toast.error("Falha ao copiar");
          }
        }}
      >
        <Copy className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}