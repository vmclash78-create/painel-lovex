import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

// Server-side middleware that authenticates callers of the second-Supabase
// license server functions. Accepts either:
//   - x-admin-jwt: an access token from the EXTERNAL Supabase auth (admins), or
//   - x-reseller-token: the reseller's URL token, matched against the resellers table.
// Fails closed with 401 otherwise.
export const requireSecondAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const adminJwt = getRequestHeader("x-admin-jwt");
    const resellerToken = getRequestHeader("x-reseller-token");

    let isAdmin = false;
    let resellerId: string | null = null;

    const url = process.env.EXTERNAL_SUPABASE_URL;
    const serviceKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Response("Server not configured", { status: 500 });
    }

    if (adminJwt) {
      try {
        const client = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.getUser(adminJwt);
        if (!error && data?.user) isAdmin = true;
      } catch {
        // fall through to reseller check
      }
    }

    if (!isAdmin && resellerToken) {
      const client = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await client
        .from("resellers")
        .select("id, active")
        .eq("token", resellerToken)
        .maybeSingle();
      if (data?.active) resellerId = data.id as string;
    }

    if (!isAdmin && !resellerId) {
      throw new Response("Unauthorized", { status: 401 });
    }

    return next({ context: { isAdmin, resellerId } });
  },
);