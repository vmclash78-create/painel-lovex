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
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            <span>Painel de Licenças</span>
          </div>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Button key={item.to} asChild variant={active ? "secondary" : "ghost"} size="sm">
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
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}