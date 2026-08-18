import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  ShieldAlert, 
  Key, 
  Download, 
  Loader2, 
  Code2, 
  Database, 
  AlertTriangle, 
  Info 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel-migracao")({
  component: MigrationPanelPage,
});

interface MigrationData {
  credentials: {
    project_url: string;
    anon_key: string;
    service_role_key: string;
  };
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  db_info?: {
    tables: any[];
  };
}

function MigrationPanelPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MigrationData | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/public/migration/info");
      const json = await res.json();
      
      // Fetch DB info using our SQL endpoint
      const dbRes = await fetch("/api/public/migration/sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key: json.credentials.service_role_key,
          sql_query: `
            SELECT 
              t.table_name,
              (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count,
              CASE 
                WHEN t.table_name IN ('licenses', 'resellers', 'user_roles') THEN 'Essencial'
                WHEN t.table_name IN ('logs', 'audit_logs', 'transactions') THEN 'Histórico'
                ELSE 'Ignorar'
              END as classification
            FROM information_schema.tables t
            WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
          `
        })
      });
      const dbJson = await dbRes.json();
      
      setData({
        ...json,
        db_info: {
          tables: Array.isArray(dbJson) ? dbJson : []
        }
      });
      toast.success("Dados carregados com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskValue = (val: string) => {
    if (!val) return "";
    if (val.length <= 20) return val;
    return `${val.substring(0, 12)}•••••${val.substring(val.length - 8)}`;
  };

  const toggleReveal = (key: string) => {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateEdgeFunctionsFile = () => {
    // Usando import.meta.glob conforme solicitado
    const functions = import.meta.glob('/supabase/functions/*/index.ts', {
      query: '?raw',
      import: 'default',
      eager: true
    });

    let content = "// ═════════ Edge Functions Backup ═════════\n\n";
    const entries = Object.entries(functions);
    
    entries.forEach(([path, code]) => {
      const name = path.split('/')[3];
      content += `// ═════════ ${name} ═════════\n\n`;
      content += code + "\n\n";
    });

    downloadFile(content, "edge-functions.ts");
    toast.info(`${entries.length} funções exportadas.`);
  };

  const generateSecretsFile = () => {
    if (!data?.secrets) return;
    let content = "export const SECRETS = {\n";
    Object.entries(data.secrets).forEach(([k, v]) => {
      content += `  "${k}": "${v}",\n`;
    });
    content += "} as const;\n\nexport type SecretKey = keyof typeof SECRETS;";
    
    downloadFile(content, "secrets.ts");
    toast.info("Secrets exportadas.");
  };

  const copyAll = () => {
    if (!data) return;
    const all = [
      "══════════ CREDENCIAIS ══════════",
      `Project URL: ${data.credentials.project_url}`,
      `Anon Key: ${data.credentials.anon_key}`,
      `Service Role Key: ${data.credentials.service_role_key}`,
      "",
      "══════════ SECRETS ══════════",
      ...Object.entries(data.secrets).map(([k, v]) => `${k}=${v}`),
    ].join("\n");
    
    navigator.clipboard.writeText(all);
    toast.success("Tudo copiado para o clipboard!");
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Painel de Migração</h1>
            <p className="mt-2 text-muted-foreground">
              Copie os itens abaixo na ordem e cole na extensão LoveX Migrate.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyAll} disabled={!data}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Tudo
            </Button>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {data ? "Recarregar" : "Revelar Tudo"}
            </Button>
          </div>
        </div>

        {!data && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-medium">Pronto para migrar?</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Clique no botão "Revelar Tudo" para carregar as informações do projeto.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Passo 1: Credenciais */}
            <Card className="overflow-hidden border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="rounded-full bg-primary/10 p-2">
                  <ShieldAlert className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Passo 1: Credenciais</CardTitle>
                  <CardDescription>Dados essenciais de conexão com o Supabase</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: "url", label: "Project URL", value: data.credentials.project_url },
                  { id: "anon", label: "Anon Key", value: data.credentials.anon_key },
                  { id: "service", label: "Service Role Key", value: data.credentials.service_role_key },
                ].map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium uppercase text-muted-foreground">{item.label}</span>
                      <div className="mt-1 font-mono text-sm truncate">
                        {revealed[item.id] ? item.value : maskValue(item.value)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => toggleReveal(item.id)}>
                        {revealed[item.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(item.value, item.label)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                  <Button className="w-full" onClick={() => copyToClipboard(data.credentials.project_url, "Project URL")}>
                    Copiar Project URL
                  </Button>
                  <Button className="w-full" variant="secondary" onClick={() => copyToClipboard(data.credentials.service_role_key, "Service Role Key")}>
                    Copiar Service Role Key
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Passo 2: Edge Functions */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Code2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Passo 2: Edge Functions</CardTitle>
                  <CardDescription>Total de {data.edge_functions_count} funções detectadas</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {data.edge_functions.map((name) => (
                  <Badge key={name} variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20">
                    {name === 'migrate-sql' ? 'sql (route)' : name === 'painel-migracao' ? 'info (route)' : name}
                  </Badge>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={generateEdgeFunctionsFile}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar edge-functions.ts
                </Button>
              </CardContent>
            </Card>

            {/* Passo 3: Secrets */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="rounded-full bg-yellow-500/10 p-2">
                  <Key className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <CardTitle>Passo 3: Secrets</CardTitle>
                  <CardDescription>Variáveis de ambiente do projeto</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-60 overflow-y-auto rounded-lg border bg-muted/20 p-2">
                  {Object.entries(data.secrets).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-border/40 p-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold">{k}</span>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {revealed[k] ? v : maskValue(v)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleReveal(k)} className="p-1 hover:text-primary">
                          {revealed[k] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(v, k)} className="p-1 hover:text-primary">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={generateSecretsFile}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar secrets.ts
                </Button>
              </CardContent>
            </Card>

            {/* Passo 4: Conferência */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="rounded-full bg-green-500/10 p-2">
                  <Database className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle>Passo 4: Conferência</CardTitle>
                  <CardDescription>Estrutura do Banco de Dados</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <div className="text-2xl font-bold">{data.db_info?.tables.length || 0}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">Tabelas</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {data.db_info?.tables.filter(t => t.classification === "Essencial").length || 0}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">Essenciais</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-500">
                      {data.db_info?.tables.filter(t => t.classification === "Histórico").length || 0}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">Histórico</div>
                  </div>
                </div>

                <div className="rounded-lg border-yellow-500/20 bg-yellow-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500" />
                    <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-400">
                      As senhas permanecem como hash bcrypt. Se o JWT Secret mudar no projeto de destino, os usuários apenas precisarão fazer login novamente; as senhas continuarão válidas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
