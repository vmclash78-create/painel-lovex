import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/client/updates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const db = url.searchParams.get("db");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("extension_updates")
          .select("id, version, title, body, is_lovepro, published_at")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(20);
        if (db === "lp") q = q.eq("is_lovepro", true);
        else if (db === "main") q = q.eq("is_lovepro", false);
        const { data, error } = await q;
        if (error) return Response.json({ updates: [] });
        return Response.json({ updates: data ?? [] });
      },
    },
  },
});