import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/external-supabase/client";
import { LogOut, Mail, ShieldCheck, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — LoveX" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="shadow-soft border-border/60">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neon-purple" aria-hidden />
            <h2 className="text-sm font-semibold">Sessão</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="truncate">{email ?? "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Autenticação real via Supabase. Sua sessão fica ativa até você sair ou o token expirar.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Sessão encerrada");
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft border-border/60">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-neon-cyan" aria-hidden />
            <h2 className="text-sm font-semibold">Bancos conectados</h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              <div>
                <div className="font-medium">Principal</div>
                <div className="text-xs text-muted-foreground">Licenças LX, revendas, compras PIX</div>
              </div>
              <span className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_8px_var(--neon-lime)]" />
            </li>
            <li className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              <div>
                <div className="font-medium">LP (Second Supabase)</div>
                <div className="text-xs text-muted-foreground">Licenças LP isoladas</div>
              </div>
              <span className="inline-block h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_8px_var(--neon-lime)]" />
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Alterne entre bancos pelo seletor no topo do painel.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}