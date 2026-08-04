import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const applyDowntimeCompensation = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getExternalAdmin } = await import("./external-admin.server");
    const admin = getExternalAdmin();
    
    const { data: licenses, error } = await admin.from('licenses').select('*');
    if (error) throw error;

    const now = new Date();
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(now.getDate() - 15);

    const logs: string[] = [];
    let count = 0;

    for (const l of licenses) {
      const createdAt = new Date(l.created_at);
      const expiresAt = new Date(l.expires_at);
      const isV19 = l.max_version?.startsWith('1.9');
      const isRecent = createdAt >= fifteenDaysAgo;

      let payload: any = null;

      if (isV19) {
        // "A da 1.9 vou zerar os dias tudo para 0 e colocar 6 dias"
        const newExpiry = new Date(now);
        newExpiry.setDate(newExpiry.getDate() + 6);
        payload = {
          expires_at: newExpiry.toISOString(),
          max_version: '2.9.9'
        };
        logs.push(`[v1.9] ${l.customer_name}: Reset + 6 days`);
      } else if (isRecent) {
        // "Para quem tá na 2.x ficará os mesmo dias Com os dias que ficou off Ou só os últimos nos 15 dias né"
        const newExpiry = new Date(expiresAt);
        newExpiry.setDate(newExpiry.getDate() + 6);
        payload = {
          expires_at: newExpiry.toISOString()
        };
        logs.push(`[Recent 2.x] ${l.customer_name}: +6 days`);
      }

      if (payload) {
        const { error: pErr } = await admin.from('licenses').update(payload).eq('id', l.id);
        if (!pErr) count++;
      }
    }

    return { count, logs };
  });
