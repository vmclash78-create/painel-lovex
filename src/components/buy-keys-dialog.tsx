import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { KEY_PACKAGES, type KeyPackage } from "@/lib/packages";
import { Loader2, ShoppingCart, Copy, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Props = {
  resellerId: string;
  resellerToken: string;
  disabled?: boolean;
};

type PixData = {
  purchaseId: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  amount: number;
  quantity: number;
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BuyKeysDialog({ resellerId, resellerToken, disabled }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<number | null>(null);

  function reset() {
    setPix(null);
    setPaid(false);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  async function buy(pkg: KeyPackage) {
    setCreating(pkg.id);
    try {
      const res = await fetch("/api/public/mp/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resellerId, packageId: pkg.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao gerar Pix");
      setPix({
        purchaseId: json.purchaseId,
        qr_code: json.qr_code,
        qr_code_base64: json.qr_code_base64,
        amount: json.amount,
        quantity: json.quantity,
      });
      // poll status
      pollRef.current = window.setInterval(async () => {
        try {
          const r = await fetch(`/api/public/mp/status?purchaseId=${json.purchaseId}`);
          const d = await r.json();
          if (d?.status === "paid") {
            setPaid(true);
            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
            qc.invalidateQueries({ queryKey: ["reseller", resellerToken] });
            toast.success(`${d.quantity} keys creditadas!`);
          }
        } catch {}
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setCreating(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5" disabled={disabled}>
          <ShoppingCart className="h-4 w-4" aria-hidden />
          Comprar Keys
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        {!pix ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Comprar pacote de keys
              </DialogTitle>
              <DialogDescription>
                Pagamento via Pix. As keys são creditadas automaticamente após a aprovação.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
              {KEY_PACKAGES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={creating !== null}
                  onClick={() => buy(p)}
                  className={`relative rounded-lg border bg-card px-3 py-3 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-50 ${p.highlight ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
                >
                  {p.highlight && (
                    <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Popular
                    </span>
                  )}
                  <div className="text-base font-semibold">{p.label}</div>
                  <div className="mt-1 text-sm text-primary font-medium">{formatBRL(p.price)}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatBRL(p.price / p.quantity)} / key
                  </div>
                  {creating === p.id && (
                    <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/70">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : paid ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Pagamento confirmado!
              </DialogTitle>
              <DialogDescription>
                {pix.quantity} keys foram creditadas no seu painel.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); reset(); }}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pagar {formatBRL(pix.amount)} via Pix</DialogTitle>
              <DialogDescription>
                {pix.quantity} keys serão liberadas automaticamente após o pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              {pix.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                  alt="QR Code Pix"
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(pix.qr_code!); toast.success("Copiado"); }
                        catch { toast.error("Falha"); }
                      }}
                    >
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
            <DialogFooter>
              <Button variant="outline" onClick={() => reset()}>Voltar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}