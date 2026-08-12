import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SettingsSchema = z.object({
  activationGraceHours: z.number().min(0).max(168), // max 1 week
  plans: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    db: z.enum(["main", "lp"]),
    maxVersion: z.string().optional(),
    description: z.string(),
    badge: z.string().optional(),
  })),
});

export type GlobalSettings = z.infer<typeof SettingsSchema>;

export const getGlobalSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    // These could be pulled from a 'settings' table in the main DB
    const { ACTIVATION_GRACE_HOURS } = await import("./activation");
    const { CLIENT_PLANS } = await import("./client-plans");

    return {
      activationGraceHours: ACTIVATION_GRACE_HOURS,
      plans: CLIENT_PLANS,
    } as GlobalSettings;
  });

export const updateGlobalSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data }) => {
    console.log("Updating settings:", data);
    // In a future turn, we can implement persistence in a DB table
    return { success: true };
  });
