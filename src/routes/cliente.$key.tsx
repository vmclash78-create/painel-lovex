import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, CalendarClock, CheckCircle2, Copy, KeyRound, Loader2, Megaphone,
  RefreshCw, ShoppingCart, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { CLIENT_PLANS, formatBRL, planForLicense, type ClientPlan } from "@/lib/client-plans";

export const Route = createFileRoute("/cliente/$key")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha Key — Portal do Cliente" }] }),
  component: ClientKeyPage,
});

type LookupOk = {
  found: true; db: "main" | "lp"; id: string; license_key: string;
  user_name: string | null; status: string | null; expires_at: string | null;
  max_version: string | null; customer_phone: string | null;
};
type LookupResult = LookupOk | { found: false };

type UpdateItem = {
  id: string; version: string; title: string; body: string | null;
  is_lovepro: boolean; published_at: string | null;
};

function daysRemaining(expires: string | null): number | null {
  if (!expires) return null;
  const diff = new Date(expires).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / 86_400_000);
}

function ClientKeyPage() {
  const { key } = Route.useParams();
  const navigate = useNavigate();
  const isBuyNew = key === "NOVA";

  const lookup = useQuery<LookupResult>({
    queryKey: ["client-lookup", key],
    queryFn: async () => {
      if (isBuyNew) return { found: false };
      const r = await fetch(`/api/public/client/lookup?key=${encodeURIComponent(key)}`);
      return r.json();
    },
  });

  const dbForUpdates: "main" | "lp" | null = lookup.data && lookup.data.found ? lookup.data.db : null;
  const updatesQ = useQuery<{ updates: UpdateItem[] }>({
    queryKey: ["client-updates", dbForUpdates ?? "all"],
    queryFn: async () => {
      const p = dbForUpdates ? `?db=${dbForUpdates}` : "";
      const r = await fetch(`/api/public/client/updates${p}`);
      return r.json();
    },
  });

  const license = lookup.data && lookup.data.found ? lookup.data : null;
  const currentPlan = license
    ? planForLicense({ db: license.db, maxVersion: license.max_version })
    : null;
  const remaining = daysRemaining(license?.expires_at ?? null);

  const [payFor, setPayFor] = useState<
    | null
    | { action: "renew" | "switch" | "new"; plan: ClientPlan; licenseKey: string | null }
  >(null);

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/cliente" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
          </Link>
          <div className="text-xs text-muted-foreground">Portal do Cliente</div>
        </div>

        {isBuyNew ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-primary" aria-hidden />
                Comprar uma nova key
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {CLIENT_PLANS.map((p) => (
                <PlanCard key={p.id} plan={p} onBuy={() => setPayFor({ action: "new", plan: p, licenseKey: null })} />
              ))}
            </CardContent>
          </Card>
        ) : lookup.isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : !license ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Key não encontrada.
              <div className="mt-4">
                <Button onClick={() => navigate({ to: "/cliente" })}>Consultar outra</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5 text-primary" aria-hidden />
                  Sua licença
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Info label="Key" value={<code className="font-mono text-xs sm:text-sm">{license.license_key}</code>} />
                <Info label="Titular" value={license.user_name ?? "—"} />
                <Info
                  label="Plano atual"
                  value={
                    currentPlan ? (
                      <Badge className="bg-primary/15 text-primary border-primary/20 whitespace-nowrap">
                        {currentPlan.name}
                      </Badge>
                    ) : "—"
                  }
                />
                <Info
                  label="Status"
                  value={<StatusPill status={license.status} remaining={remaining} />}
                />
                <Info
                  label="Expira em"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {license.expires_at
                        ? new Date(license.expires_at).toLocaleDateString("pt-BR")
                        : "—"}
                      {remaining !== null && (
                        <span className="text-xs text-muted-foreground">({remaining}d)</span>
                      )}
                    </span>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-4 w-4 text-primary" aria-hidden />
                  Renovar ou mudar de plano
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {CLIENT_PLANS.map((p) => {
                  const isSamePlan = currentPlan?.id === p.id;
                  const isSwitchable = p.db === "main" && license.db === "main";
                  const action: "renew" | "switch" = isSamePlan ? "renew" : "switch";
                  const disabled = !isSamePlan && !isSwitchable;
                  return (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      highlight={isSamePlan}
                      cta={isSamePlan ? "Renovar 30 dias" : disabled ? "Indisponível" : "Trocar para este plano"}
                      disabled={disabled}
                      onBuy={() => setPayFor({ action, plan: p, licenseKey: license.license_key })}
                    />
                  );
                })}
              </CardContent>
            </Card>

            <UpdatesCard items={updatesQ.data?.updates ?? []} loading={updatesQ.isLoading} />
          </>
        )}
      </div>

      <PayDialog
        state={payFor}
        onClose={() => setPayFor(null)}
        onPaid={() => {
          setPayFor(null);
          lookup.refetch();
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function StatusPill({ status, remaining }: { status: string | null; remaining: number | null }) {
  let s = status ?? "active";
  if (s !== "revoked" && remaining !== null && remaining <= 0) s = "expired";
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    trial: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    expired: "bg-red-500/15 text-red-500 border-red-500/20",
    revoked: "bg-red-500/15 text-red-500 border-red-500/20",
    paused: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    inactive: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };
  return <Badge className={`${map[s] ?? map.active} whitespace-nowrap`}>{s}</Badge>;
}

function PlanCard({
  plan, onBuy, highlight, cta = "Comprar", disabled,
}: { plan: ClientPlan; onBuy: () => void; highlight?: boolean; cta?: string; disabled?: boolean }) {
  return (
    <div className={`relative rounded-lg border bg-card p-3 ${highlight ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
      {plan.badge && (
        <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          {plan.badge}
        </span>
      )}
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        {plan.name}
      </div>
      <div className="mt-1 text-lg font-bold text-primary">{formatBRL(plan.price)}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{plan.description}</p>
      <Button
        size="sm"
        className="mt-3 w-full"
        disabled={disabled}
        onClick={onBuy}
      >
        {cta}
      </Button>
    </div>
  );
}

function UpdatesCard({ items, loading }: { items: UpdateItem[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-primary" aria-hidden />
          Atualizações da extensão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="grid place-items-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhuma atualização publicada ainda.
          </div>
        ) : (
          items.map((u) => (
            <div key={u.id} className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{u.title}</span>
                <Badge variant="outline" className="whitespace-nowrap">v{u.version}</Badge>
                {u.published_at && (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(u.published_at).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              {u.body && (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{u.body}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PayDialog({
  state, onClose, onPaid,
}: {
  state: null | { action: "renew" | "switch" | "new"; plan: ClientPlan; licenseKey: string | null };
  onClose: () => void;
  onPaid: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const [pix, setPix] = useState<{ purchaseId: string; qr_code: string | null; qr_code_base64: string | null; amount: number } | null>(null);
  const [paid, setPaid] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);
  useEffect(() => {
    if (!state) {
      setPix(null); setPaid(false); setNewKey(null); setPhone("");
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [state]);

  if (!state) return null;

  async function create() {
    if (!state) return;
    setCreating(true);
    try {
      const r = await fetch("/api/public/client/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: state.action,
          plan_id: state.plan.id,
          license_key: state.licenseKey ?? undefined,
          customer_phone: phone || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Falha ao gerar Pix");
      setPix({
        purchaseId: j.purchaseId,
        qr_code: j.qr_code,
        qr_code_base64: j.qr_code_base64,
        amount: j.amount,
      });
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await fetch(`/api/public/client/status?purchaseId=${j.purchaseId}`);
          const d = await s.json();
          if (d?.status === "paid") {
            setPaid(true);
            setNewKey(d.new_license_key ?? null);
            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
            toast.success("Pagamento confirmado!");
          }
        } catch {}
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {paid ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Pagamento confirmado!
              </DialogTitle>
              <DialogDescription>
                {state.action === "new"
                  ? "Sua nova key foi criada."
                  : state.action === "switch"
                    ? "Plano atualizado e prazo estendido."
                    : "Sua licença foi renovada por mais 30 dias."}
              </DialogDescription>
            </DialogHeader>
            {newKey && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground">Sua nova key</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="font-mono text-sm">{newKey}</code>
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await navigator.clipboard.writeText(newKey); toast.success("Copiado"); }
                    catch { toast.error("Falha"); }
                  }}>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={onPaid}>Fechar</Button>
            </DialogFooter>
          </>
        ) : !pix ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {state.action === "renew" && `Renovar — ${state.plan.name}`}
                {state.action === "switch" && `Trocar para ${state.plan.name}`}
                {state.action === "new" && `Comprar ${state.plan.name}`}
              </DialogTitle>
              <DialogDescription>
                Total: <strong>{formatBRL(state.plan.price)}</strong> — pagamento via Pix.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Telefone (opcional, para contato)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 91234-5678" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Gerar Pix"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pagar {formatBRL(pix.amount)} via Pix</DialogTitle>
              <DialogDescription>
                A confirmação é automática após o pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              {pix.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR Pix"
                  className="h-56 w-56 rounded-md border bg-white p-2"
                />
              )}
              {pix.qr_code && (
                <div className="w-full">
                  <div className="text-xs text-muted-foreground mb-1">Pix Copia e Cola:</div>
                  <div className="flex gap-2">
                    <textarea
                      readOnly
                      value={pix.qr_code}
                      className="flex-1 h-20 rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-mono resize-none"
                    />
                    <Button variant="outline" size="sm" onClick={async () => {
                      try { await navigator.clipboard.writeText(pix.qr_code!); toast.success("Copiado"); }
                      catch { toast.error("Falha"); }
                    }}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Aguardando pagamento...
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}