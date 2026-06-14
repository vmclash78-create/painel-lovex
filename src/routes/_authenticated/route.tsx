import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, KeyRound, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
                  <Link to={item.to} className="gap-2">
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
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