import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CLIENT_PLANS, formatBRL } from "@/lib/client-plans";
import {
  KeyRound, Search, ShieldCheck, Zap, Sparkles, MessageCircle,
  ArrowRight, CheckCircle2, Loader2, Rocket, Clock, LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";

const WHATSAPP = "5588992361465";
const WHATSAPP_DISPLAY = "(88) 99236-1465";

type UpdateItem = {
  id: string;
  version: string;
  title: string;
  body: string | null;
  is_lovepro: boolean;
  published_at: string | null;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoveX & LovePro — Extensões premium para Lovable" },
      { name: "description", content: "Compre, renove e gerencie suas keys das extensões LoveX e LovePro. Ative em segundos via Pix, com suporte direto no WhatsApp." },
      { property: "og:title", content: "LoveX & LovePro — Extensões premium para Lovable" },
      { property: "og:description", content: "Ative sua key em segundos via Pix. Consulte, renove ou compre uma nova licença direto no site." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <BackgroundFX />
      <SiteHeader />
      <main className="relative">
        <Hero />
        <Features />
        <Plans />
        <Updates />
        <ClientArea />
        <ResellerCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
      <div className="absolute top-[40vh] -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20vh] -left-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg gradient-primary shadow-neon">
            <Sparkles className="h-4 w-4 text-primary-foreground" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">LoveX · LovePro</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#planos" className="hover:text-foreground">Planos</a>
          <a href="#novidades" className="hover:text-foreground">Novidades</a>
          <a href="#cliente" className="hover:text-foreground">Minha Key</a>
          <a href="#revendedor" className="hover:text-foreground">Revenda</a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank" rel="noreferrer"
            className="hidden sm:inline-flex"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
            </Button>
          </a>
          <Link to="/auth">
            <Button size="sm" variant="ghost" className="gap-1.5">
              <LockKeyhole className="h-4 w-4" aria-hidden /> Admin
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="mx-auto max-w-4xl text-center">
        {/* oi */}
        <Badge variant="outline" className="mb-5 border-primary/40 bg-primary/10 text-primary">
          <Sparkles className="mr-1 h-3 w-3" aria-hidden /> Ativação instantânea via Pix
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Turbine seu <span className="text-gradient-primary">Lovable</span> com<br className="hidden sm:inline" />
          extensões premium.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          LoveX e LovePro entregam recursos avançados para você construir mais rápido.
          Compre a sua key, renove em 1 clique ou troque de plano sem perder o histórico.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#planos">
            <Button size="lg" className="gap-2 shadow-elegant">
              <Rocket className="h-4 w-4" aria-hidden /> Ver planos
            </Button>
          </a>
          <a href="#cliente">
            <Button size="lg" variant="outline" className="gap-2">
              <KeyRound className="h-4 w-4" aria-hidden /> Já tenho uma key
            </Button>
          </a>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Pagamento via Pix</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Liberação automática</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Suporte no WhatsApp</span>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Zap, title: "Liberação em segundos", desc: "Pague com Pix e sua key é liberada automaticamente pelo webhook." },
    { icon: ShieldCheck, title: "Sua key, seu controle", desc: "Consulte tempo restante, renove ou troque de plano quando quiser." },
    { icon: Clock, title: "Renovação inteligente", desc: "Ao renovar antes do vencimento, os dias somam — nunca são perdidos." },
  ];
  return (
    <section className="px-4 pb-10">
      <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <it.icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="text-sm font-semibold">{it.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Plans() {
  const navigate = useNavigate();
  return (
    <section id="planos" className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Escolha o seu plano</h2>
          <p className="mt-3 text-muted-foreground">
            Todos os planos com 30 dias de acesso. Renove ou troque quando precisar.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CLIENT_PLANS.map((p, i) => {
            const highlight = i === 1;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur transition ${
                  highlight
                    ? "border-primary/50 bg-primary/5 shadow-neon"
                    : "border-border/60 bg-card/60 hover:border-primary/30"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-2 right-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {p.badge}
                  </span>
                )}
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {p.db === "lp" ? "LovePro" : "LoveX"}
                </div>
                <div className="mt-1 text-xl font-semibold">{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{formatBRL(p.price)}</span>
                  <span className="text-sm text-muted-foreground">/ 30 dias</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Acesso completo por 30 dias</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Ativação automática via Pix</li>
                  {p.maxVersion && (
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Versões até {p.maxVersion}</li>
                  )}
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Renovação sem perder dias</li>
                </ul>
                <Button
                  className="mt-6 gap-2"
                  variant={highlight ? "default" : "outline"}
                  onClick={() => navigate({ to: "/cliente/$key", params: { key: "NOVA" }, hash: p.id })}
                >
                  Comprar agora <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já é cliente? Você também pode <a href="#cliente" className="text-primary hover:underline">renovar ou trocar de plano</a> mantendo sua key atual.
        </p>
      </div>
    </section>
  );
}

function Updates() {
  const [items, setItems] = useState<UpdateItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/public/client/updates")
      .then((r) => r.json())
      .then((j) => { if (alive) setItems(j.updates ?? []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  return (
    <section id="novidades" className="border-t border-border/40 bg-card/20 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Novidades das extensões</h2>
            <p className="mt-2 text-muted-foreground">O que mudou nas últimas versões do LoveX e LovePro.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {items === null && (
            <div className="col-span-full flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Carregando...
            </div>
          )}
          {items && items.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
              Nenhuma novidade publicada ainda. Volte em breve.
            </div>
          )}
          {items?.map((u) => (
            <article key={u.id} className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="border-primary/40 text-primary">v{u.version}</Badge>
                <Badge variant="secondary" className="text-[10px]">{u.is_lovepro ? "LovePro" : "LoveX"}</Badge>
                {u.published_at && (
                  <span className="text-muted-foreground">
                    {new Date(u.published_at).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-base font-semibold">{u.title}</h3>
              {u.body && (
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground line-clamp-6">{u.body}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClientArea() {
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
      if (!r.ok || !j.found) { toast.error("Key não encontrada"); return; }
      navigate({ to: "/cliente/$key", params: { key: k.toUpperCase() } });
    } catch { toast.error("Erro ao consultar"); }
    finally { setChecking(false); }
  }

  return (
    <section id="cliente" className="px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Área do cliente</h2>
          <p className="mt-3 text-muted-foreground">
            Digite sua key para ver o tempo restante, renovar, trocar de plano ou comprar uma nova.
            Sem cadastro, sem senha — sua key é o seu acesso.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Ver dias restantes e plano ativo</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Renovar mantendo a mesma key</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Trocar de plano (LoveX 1.9 → 2.x)</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Comprar uma key adicional</li>
          </ul>
        </div>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Consultar minha key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="LX-XXXXXXXX-XXXXXXXX"
              onKeyDown={(e) => { if (e.key === "Enter") check(); }}
              className="font-mono"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1 gap-1.5" onClick={check} disabled={checking || key.trim().length < 6}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                Acessar painel
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/cliente/$key", params: { key: "NOVA" } })}>
                Comprar nova
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ao acessar, você verá o status, poderá renovar ou trocar de plano.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ResellerCta() {
  return (
    <section id="revendedor" className="px-4 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/60 to-background p-8 sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
                Programa de revenda
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Quer <span className="text-gradient-primary">revender</span> LoveX e LovePro?
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Compre pacotes de keys com desconto, ative para seus clientes com 1 clique e
                acompanhe tudo pelo seu painel exclusivo. Ideal para quem já vende para a comunidade Lovable.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Quero ser revendedor LoveX/LovePro.")}`} target="_blank" rel="noreferrer">
                  <Button size="lg" className="gap-2 shadow-elegant">
                    <MessageCircle className="h-4 w-4" aria-hidden /> Falar no WhatsApp
                  </Button>
                </a>
                <a href="#planos">
                  <Button size="lg" variant="outline">Ver planos primeiro</Button>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: "Pacotes", d: "1 a 200 keys" },
                { t: "Desconto", d: "por volume" },
                { t: "Ativação", d: "instantânea" },
                { t: "Painel", d: "próprio" },
              ].map((it) => (
                <div key={it.t} className="rounded-xl border border-border/60 bg-card/70 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{it.t}</div>
                  <div className="mt-1 font-semibold text-primary">{it.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/20 px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md gradient-primary">
            <Sparkles className="h-3 w-3 text-primary-foreground" aria-hidden />
          </span>
          <span>LoveX · LovePro — © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
          <Link to="/auth" className="hover:text-foreground">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
