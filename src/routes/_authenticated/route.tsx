import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, KeyRound, ShieldCheck, Users, LogOut, Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/external-supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setAuthed(true);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (!session) {
        setAuthed(false);
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!checked || !authed) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/licenses", label: "Licenças", icon: KeyRound },
    { to: "/resellers", label: "Revendas", icon: Users },
    { to: "/second-panel", label: "Painel LP", icon: Database },
  ] as const;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold sm:gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="hidden truncate text-sm tracking-tight sm:inline sm:text-base">
              Painel de <span className="text-gradient-primary">Licenças</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-0.5 sm:gap-1">
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
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Sessão encerrada");
              navigate({ to: "/auth", replace: true });
            }}
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