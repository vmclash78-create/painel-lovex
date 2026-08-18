import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/migration/sql")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response("ok", {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        });
      },
      POST: async ({ request }) => {
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Content-Type": "application/json",
        };

        try {
          const body = await request.json();
          const { key, sql_query } = body;

          if (!key || !sql_query) {
            return new Response(JSON.stringify({ error: "Missing key or sql_query" }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          const supabaseUrl = process.env.SUPABASE_URL;
          if (!supabaseUrl) {
            throw new Error("SUPABASE_URL not set in environment");
          }

          const supabase = createClient(supabaseUrl, key);
          const { data, error } = await supabase.rpc("exec_sql", { sql_query });

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          return new Response(JSON.stringify(data), {
            status: 200,
            headers: corsHeaders,
          });
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
