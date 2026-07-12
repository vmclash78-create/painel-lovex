import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/external-supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Lock, Mail, KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Painel de Licenças" },
      { name: "description", content: "Acesso administrativo ao painel de licenças." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* Neon backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 15%, color-mix(in oklab, var(--neon-purple) 30%, transparent), transparent 60%), radial-gradient(50% 40% at 85% 25%, color-mix(in oklab, var(--neon-cyan) 25%, transparent), transparent 65%), radial-gradient(45% 40% at 75% 90%, color-mix(in oklab, var(--neon-pink) 22%, transparent), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--foreground) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 40%, transparent) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div className="relative z-10 grid min-h-dvh place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-xl border border-border/50 bg-card/60 backdrop-blur"
              style={{ boxShadow: "0 0 24px color-mix(in oklab, var(--neon-purple) 45%, transparent)" }}
            >
              <ShieldCheck className="h-5 w-5 text-neon-cyan" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">LoveX</div>
              <div className="text-sm font-semibold">Control Panel</div>
            </div>
          </div>

          {/* Card */}
          <div
            className="relative rounded-2xl border border-border/50 bg-card/70 p-6 backdrop-blur-xl sm:p-8"
            style={{
              boxShadow:
                "0 20px 60px -20px color-mix(in oklab, var(--neon-purple) 40%, transparent), inset 0 1px 0 color-mix(in oklab, var(--foreground) 8%, transparent)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 -top-px h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--neon-cyan), var(--neon-purple), var(--neon-pink), transparent)",
              }}
            />

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight">Acesso ao Painel</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Área restrita — entre com suas credenciais
              </p>
            </div>

            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@painel.local"
                    className="h-11 border-border/60 bg-background/50 pl-10 focus-visible:ring-neon-cyan/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 border-border/60 bg-background/50 pl-10 pr-16 focus-visible:ring-neon-purple/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPw ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="relative h-11 w-full gap-2 overflow-hidden font-semibold text-primary-foreground"
                style={{
                  background: "linear-gradient(135deg, var(--neon-purple), var(--neon-pink))",
                  boxShadow: "0 8px 32px -8px color-mix(in oklab, var(--neon-purple) 70%, transparent)",
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
                {loading ? "Entrando..." : "Entrar no painel"}
              </Button>

              <div className="flex items-center justify-center gap-2 pt-1">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full bg-neon-lime"
                  style={{ boxShadow: "0 0 10px var(--neon-lime)" }}
                />
                <p className="text-center text-[11px] text-muted-foreground">
                  Conexão segura • Cadastros novos desativados
                </p>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} LoveX Control Panel
          </p>
        </div>
      </div>
    </main>
  );
}
