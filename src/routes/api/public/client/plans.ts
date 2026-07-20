import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/client/plans")({
  server: {
    handlers: {
      GET: async () => {
        const { planListForClient } = await import("@/lib/client-purchase.server");
        return Response.json({ plans: planListForClient() });
      },
    },
  },
});