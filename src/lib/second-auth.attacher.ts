import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/external-supabase/client";

// Client-side middleware that attaches authentication headers used by
// requireSecondAuth on the server:
//   - x-admin-jwt: current EXTERNAL Supabase admin access token, if any
//   - x-reseller-token: URL token when the caller is on /r/:token
export const attachSecondAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const headers: Record<string, string> = {};
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers["x-admin-jwt"] = token;
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      const m = window.location.pathname.match(/^\/r\/([^/?#]+)/);
      if (m) headers["x-reseller-token"] = decodeURIComponent(m[1]);
    }
    return next({ headers });
  },
);