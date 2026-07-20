import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/client/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("purchaseId");
        if (!id) return Response.json({ error: "missing" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("client_purchases")
          .select("id, status, amount, paid_at, action, plan_id, new_license_key, license_key")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(data);
      },
    },
  },
});