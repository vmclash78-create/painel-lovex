import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/client/lookup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        if (!key || key.length < 6 || key.length > 64) {
          return Response.json({ error: "invalid_key" }, { status: 400 });
        }
        const { lookupLicense } = await import("@/lib/client-purchase.server");
        const res = await lookupLicense(key);
        return Response.json(res);
      },
    },
  },
});