import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mp/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const purchaseId = url.searchParams.get("purchaseId");
        if (!purchaseId) return Response.json({ error: "missing" }, { status: 400 });
        const { getExternalAdmin } = await import("@/lib/external-admin.server");
        const admin = getExternalAdmin();
        const { data, error } = await admin
          .from("reseller_purchases")
          .select("id, status, quantity, amount, paid_at")
          .eq("id", purchaseId).maybeSingle();
        if (error || !data) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json(data);
      },
    },
  },
});