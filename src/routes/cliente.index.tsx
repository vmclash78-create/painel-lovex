import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente — Consultar Key" },
      { name: "description", content: "Consulte sua key, renove, mude de plano ou compre uma nova." },
    ],
  }),
  component: ClientHomePage,
});

function ClientHomePage() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);

  async function check() {
    const k = key.trim();
    if (!k) return;
    setChecking(true);
    try {
      const r = await fetch(`/api/public/client/lookup?key=${encodeURIComponent(k)}`);
      const j = await r.json();
      if (!r.ok || !j.found) {
        toast.error("Key não encontrada");
        return;
      }
      navigate({ to: "/cliente/$key", params: { key: k.toUpperCase() } });
    } catch {
      toast.error("Erro ao consultar");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Portal do Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Consulte sua licença, veja o tempo restante, renove ou compre uma nova.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultar minha key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="LX-XXXXXXXX-XXXXXXXX"
              onKeyDown={(e) => { if (e.key === "Enter") check(); }}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" onClick={check} disabled={checking || key.trim().length < 6}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                Consultar
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/cliente/$key", params: { key: "NOVA" } })}>
                Comprar nova
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}