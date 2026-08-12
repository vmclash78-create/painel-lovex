import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SettingsSchema = z.object({
  activationGraceHours: z.number().min(0).max(168),
  plans: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    db: z.enum(["main", "lp"]),
    maxVersion: z.string().optional(),
    description: z.string(),
    badge: z.string().optional(),
  })),
  whatsappNumber: z.string().optional(),
  whatsappDisplay: z.string().optional(),
});

export type GlobalSettings = z.infer<typeof SettingsSchema>;

export const getGlobalSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { ACTIVATION_GRACE_HOURS } = await import("./activation");
    const { CLIENT_PLANS } = await import("./client-plans");
    // Mocking WhatsApp config for now as it's hardcoded in index.tsx
    // In a real migration we'd move this to a DB table
    return {
      activationGraceHours: ACTIVATION_GRACE_HOURS,
      plans: CLIENT_PLANS,
      whatsappNumber: "5588992361465",
      whatsappDisplay: "(88) 99236-1465",
    } as GlobalSettings;
  });

export const updateGlobalSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data }) => {
    console.log("Saving settings to backend...", data);
    // Future: persist to Supabase settings table
    return { success: true };
  });
