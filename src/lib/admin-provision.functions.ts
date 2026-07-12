import { createServerFn } from "@tanstack/react-start";

// One-shot admin provisioning. Creates (or resets password of) an admin
// user on the EXTERNAL Supabase used by the panel. Safe to call multiple
// times — idempotent.
export const provisionAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { getExternalAdmin } = await import("./external-admin.server");
  const admin = getExternalAdmin();
  const email = "admin@painel.local";
  const password = "12345678";

  // Try to find existing user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(listErr.message);
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, email, created: false };
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const, email, created: true };
});