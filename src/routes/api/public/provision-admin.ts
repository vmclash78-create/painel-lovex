import { createFileRoute } from "@tanstack/react-router";

// One-shot admin provisioning endpoint. Creates or resets the demo admin
// user on the EXTERNAL Supabase used by the panel. Idempotent.
// Guarded by a shared secret in the query string.
export const Route = createFileRoute("/api/public/provision-admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        if (token !== "lovex-provision-2026") {
          return new Response("forbidden", { status: 403 });
        }
        const { getExternalAdmin } = await import("@/lib/external-admin.server");
        const admin = getExternalAdmin();
        const email = "admin@painel.local";
        const password = "12345678";

        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (listErr) return Response.json({ ok: false, error: listErr.message }, { status: 500 });
        const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);

        if (existing) {
          const { error } = await admin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          });
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true, email, created: false });
        }

        const { error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, email, created: true });
      },
    },
  },
});