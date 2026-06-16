import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type License } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  license: License;
  /** Restrict update to a specific reseller (used in public reseller panel). */
  resellerId?: string;
  /** Query keys to invalidate after a successful reset. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export function ResetLicenseDialog({ license, resellerId, invalidateKeys }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clearDevice, setClearDevice] = useState(true);
  const [resetSession, setResetSession] = useState(true);
  const [renewExpiry, setRenewExpiry] = useState(false);
  const [reactivate, setReactivate] = useState(false);

  const canRenew = !!license.duration_minutes && license.duration_minutes > 0;
  const nothingSelected = !clearDevice && !resetSession && !renewExpiry && !reactivate;

  const reset = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (clearDevice) {
        patch.device_id = null;
        patch.activated_at = null;
      }
      if (resetSession) patch.session_id = crypto.randomUUID();
      if (reactivate) patch.status = "active";
      if (renewExpiry && canRenew) {
        patch.expires_at = new Date(
          Date.now() + (license.duration_minutes ?? 0) * 60_000,
        ).toISOString();
      }
      let q = supabase.from("licenses").update(patch).eq("id", license.id);
      if (resellerId) q = q.eq("reseller_id", resellerId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença reiniciada");
      (invalidateKeys ?? [["licenses"], ["reseller-licenses"]]).forEach((key) => {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Resetar" title="Resetar (escolher opções)">
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resetar licença</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {license.license_key}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Escolha o que deseja resetar:</p>

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
            <Checkbox
              checked={clearDevice}
              onCheckedChange={(v) => setClearDevice(!!v)}
              id="opt-device"
            />
            <div className="space-y-0.5">
              <Label htmlFor="opt-device" className="cursor-pointer">Dispositivo vinculado</Label>
              <p className="text-xs text-muted-foreground">
                Limpa o device e a data de ativação. Atual: {license.device_id ? "vinculado" : "nenhum"}.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
            <Checkbox
              checked={resetSession}
              onCheckedChange={(v) => setResetSession(!!v)}
              id="opt-session"
            />
            <div className="space-y-0.5">
              <Label htmlFor="opt-session" className="cursor-pointer">Sessão</Label>
              <p className="text-xs text-muted-foreground">
                Gera um novo session_id e força logout do app.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
              canRenew ? "" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <Checkbox
              checked={renewExpiry && canRenew}
              disabled={!canRenew}
              onCheckedChange={(v) => setRenewExpiry(!!v)}
              id="opt-expiry"
            />
            <div className="space-y-0.5">
              <Label htmlFor="opt-expiry" className="cursor-pointer">Renovar validade</Label>
              <p className="text-xs text-muted-foreground">
                {canRenew
                  ? `Define expira em a partir de agora (${license.duration_minutes} min).`
                  : "Esta licença não tem duração definida."}
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
            <Checkbox
              checked={reactivate}
              onCheckedChange={(v) => setReactivate(!!v)}
              id="opt-status"
            />
            <div className="space-y-0.5">
              <Label htmlFor="opt-status" className="cursor-pointer">Reativar status</Label>
              <p className="text-xs text-muted-foreground">
                Define status como Ativa (útil se estava expirada/revogada).
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => reset.mutate()}
            disabled={reset.isPending || nothingSelected}
          >
            {reset.isPending ? "Resetando..." : "Resetar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}