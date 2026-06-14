import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, KeyRound, ShieldCheck, Users, Lock, LogOut } from "lucide-react";
import { isAdminUnlocked, unlockAdmin, lockAdmin } from "@/lib/admin-gate";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUnlocked(isAdminUnlocked());
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!unlocked) return <AdminGate onUnlock={() => setUnlocked(true)} />;

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/licenses", label: "Licenças", icon: KeyRound },
    { to: "/resellers", label: "Revendas", icon: Users },
  ] as const;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base tracking-tight">
              Painel de <span className="text-gradient-primary">Licenças</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "default" : "ghost"}
                  size="sm"
                  className={active ? "shadow-elegant" : ""}
                >
                  <Link to={item.to} aria-label={item.label} className="gap-2">
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => { lockAdmin(); setUnlocked(false); }}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ok = unlockAdmin(password);
    setLoading(false);
    if (!ok) {
      toast.error("Senha incorreta");
      return;
    }
    toast.success("Acesso liberado");
    onUnlock();
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Área restrita</CardTitle>
          <CardDescription>Informe a senha de administrador para acessar o painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adm-pwd">Senha</Label>
              <Input
                id="adm-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {loading ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}