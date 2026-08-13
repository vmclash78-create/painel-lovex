import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/external-supabase/client";
import { 
  LogOut, Mail, ShieldCheck, Database, Settings as SettingsIcon, 
  Clock, CreditCard, Save, Plus, Trash2, Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { getGlobalSettings, updateGlobalSettings, type GlobalSettings } from "@/lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { formatBRL } from "@/lib/client-plans";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — LoveX" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  
  const fetchSettingsFn = useServerFn(getGlobalSettings);
  const updateSettingsFn = useServerFn(updateGlobalSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["global-settings"],
    queryFn: () => fetchSettingsFn(),
  });

  const updateSettings = useMutation({
    mutationFn: (newSettings: GlobalSettings) => updateSettingsFn({ data: newSettings }),
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso");
      qc.invalidateQueries({ queryKey: ["global-settings"] });
    },
    onError: (e: Error) => toast.error("Falha ao salvar: " + e.message),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações Gerais</h1>
        <p className="text-muted-foreground">Gerencie o comportamento global do sistema LoveX e LovePro.</p>
      </header>

      <div className="grid gap-6">
        {/* Painel de Licenciamento */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-neon-purple" />
              <div>
                <CardTitle>Regras de Licenciamento</CardTitle>
                <CardDescription>Configure como as chaves são ativadas e expiram.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="grace-hours">Janela de Carência (Horas)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="grace-hours" 
                    type="number" 
                    defaultValue={settings?.activationGraceHours ?? 48}
                    className="max-w-[120px]"
                  />
                  <span className="text-sm text-muted-foreground">horas</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo que o cliente tem para o 1º acesso antes que a validade comece a contar automaticamente. 
                  (Aplicado apenas a keys de <strong>Trial</strong>; Keys normais aguardam indefinidamente).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planos e Preços */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-neon-cyan" />
              <div>
                <CardTitle>Planos e Preços</CardTitle>
                <CardDescription>Configure os planos visíveis para os clientes na landing page.</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nome</th>
                    <th className="px-4 py-3 text-left font-medium">Banco</th>
                    <th className="px-4 py-3 text-left font-medium">Versão Max</th>
                    <th className="px-4 py-3 text-left font-medium">Preço</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {settings?.plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          plan.db === 'main' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                        }`}>
                          {plan.db === 'main' ? 'LoveX' : 'LovPro'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{plan.maxVersion || '—'}</td>
                      <td className="px-4 py-3 font-medium">{formatBRL(plan.price)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp e Suporte */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-500" />
              <div>
                <CardTitle>Canais de Atendimento</CardTitle>
                <CardDescription>Configure os links de suporte via WhatsApp.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wa-number">Número WhatsApp (Internacional)</Label>
                <Input 
                  id="wa-number" 
                  defaultValue={settings?.whatsappNumber ?? ""} 
                  placeholder="5588992361465"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-display">Texto de Exibição</Label>
                <Input 
                  id="wa-display" 
                  defaultValue={settings?.whatsappDisplay ?? ""} 
                  placeholder="(88) 99236-1465"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp e Suporte */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="bg-muted/30">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-500" />
              <div>
                <CardTitle>Canais de Atendimento</CardTitle>
                <CardDescription>Configure os links de suporte via WhatsApp.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wa-number">Número WhatsApp (Internacional)</Label>
                <Input 
                  id="wa-number" 
                  defaultValue={settings?.whatsappNumber ?? ""} 
                  placeholder="5588992361465"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-display">Texto de Exibição</Label>
                <Input 
                  id="wa-display" 
                  defaultValue={settings?.whatsappDisplay ?? ""} 
                  placeholder="(88) 99236-1465"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Infraestrutura e Segurança */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-soft border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-neon-lime" />
                <CardTitle className="text-base">Sessão Admin</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{email ?? "—"}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Sessão encerrada");
                  navigate({ to: "/auth", replace: true });
                }}
              >
                <LogOut className="h-4 w-4" /> Sair do Painel
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-neon-cyan" />
                <CardTitle className="text-base">Status das Conexões</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>LoveX (External SB)</span>
                <span className="flex items-center gap-1.5 text-neon-lime text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_8px_var(--neon-lime)]" />
                  Conectado
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>LovPro (Second SB)</span>
                <span className="flex items-center gap-1.5 text-neon-lime text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_8px_var(--neon-lime)]" />
                  Conectado
                </span>
              </div>
              <Separator />
              <p className="text-[10px] text-muted-foreground text-center">
                V3.2.0-stable · Lovable Cloud Environment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Ações Fixa */}
        <div className="sticky bottom-4 left-0 right-0 flex justify-center px-4">
          <Button 
            className="shadow-lg shadow-primary/20 gap-2 h-11 px-8 rounded-full bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            onClick={() => {
              // Collect form values and save
              const graceInput = document.getElementById('grace-hours') as HTMLInputElement;
              if (settings) {
                updateSettings.mutate({
                  ...settings,
                  activationGraceHours: Number(graceInput.value),
                  whatsappNumber: (document.getElementById('wa-number') as HTMLInputElement).value,
                  whatsappDisplay: (document.getElementById('wa-display') as HTMLInputElement).value,
                });
              }
            }}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Todas as Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
