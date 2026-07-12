import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/external-supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DbSwitcher } from "@/components/db-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard Principal", subtitle: "Visão geral do banco Principal — sistema completo" },
  "/licenses": { title: "Keys", subtitle: "Gerenciamento completo de licenças" },
  "/resellers": { title: "Revendedores", subtitle: "Parceiros e cotas de revenda" },
  "/second-panel": { title: "Banco LP", subtitle: "Licenças isoladas do Second Supabase" },
  "/logs": { title: "Logs & Auditoria", subtitle: "Transações, compras e movimentações" },
  "/settings": { title: "Configurações", subtitle: "Sessão e preferências do painel" },
};

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.session?.user.email ?? null);
      setAuthed(true);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (!session) {
        setAuthed(false);
        navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(session?.user.email ?? null);
      setAuthed(true);
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

  const meta = PAGE_META[pathname] ?? { title: "Painel", subtitle: "" };
  const initials = (email ?? "V T").split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "VT";

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/50 bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">{meta.title}</h1>
              {meta.subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{meta.subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DbSwitcher />
              <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
                <Bell className="h-4 w-4" aria-hidden />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card text-xs font-semibold hover:border-primary/50"
                    aria-label="Menu do usuário"
                  >
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{email ?? "Admin"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })} className="gap-2">
                    <User className="h-4 w-4" aria-hidden /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      await supabase.auth.signOut();
                      toast.success("Sessão encerrada");
                      navigate({ to: "/auth", replace: true });
                    }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}