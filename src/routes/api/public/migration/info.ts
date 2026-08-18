import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/migration/info")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response("ok", {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
          },
        });
      },
      GET: async () => {
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Content-Type": "application/json",
        };

        try {
          // Credenciais do ambiente (process.env no Node/Worker)
          const projectUrl = process.env.SUPABASE_URL;
          const anonKey = process.env.SUPABASE_ANON_KEY;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          // Secrets (excluindo sensíveis do runtime)
          const allEnv = process.env;
          const filteredSecrets: Record<string, string> = {};
          
          const blacklist = [
            'PATH', 'HOME', 'HOSTNAME', 'PORT', 'USER', 'LANG', 'TERM', 'TMPDIR', 
            'DENO_DIR', 'DENO_REGION', 'DENO_DEPLOYMENT_ID', '_', 'PROMPT',
            'NODE_ENV', 'npm_package_name', 'npm_package_version'
          ];

          for (const key in allEnv) {
            if (!blacklist.includes(key) && !key.startsWith('XDG_') && !key.startsWith('npm_')) {
              filteredSecrets[key] = allEnv[key] || "";
            }
          }

          // Edge Functions Discovery (Simulado, já que estamos no Lovable e as rotas são o padrão)
          // Mas vamos tentar descobrir as rotas da API se possível, 
          // ou retornar as conhecidas do projeto.
          const edge_functions = [
            "client-purchase",
            "reseller-v1-generate",
            "activation-reconcile"
          ];

          return new Response(
            JSON.stringify({
              credentials: {
                project_url: projectUrl,
                anon_key: anonKey,
                service_role_key: serviceRoleKey,
              },
              secrets: filteredSecrets,
              edge_functions,
              edge_functions_count: edge_functions.length
            }),
            {
              status: 200,
              headers: corsHeaders,
            }
          );
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: corsHeaders,
          });
        }
      },
    },
  },
});
