import { createServerFn } from "@tanstack/react-start";
import { SettingsSchema, type GlobalSettings } from "./settings.schema";

export type { GlobalSettings };

export const getGlobalSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { ACTIVATION_GRACE_HOURS } = await import("./activation");
    const { CLIENT_PLANS } = await import("./client-plans");
    return {
      activationGraceHours: ACTIVATION_GRACE_HOURS,
      plans: CLIENT_PLANS,
      whatsappNumber: "5588992361465",
      whatsappDisplay: "(88) 99236-1465",
    } as GlobalSettings;
  });

export const updateGlobalSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data }) => {
    return { success: true, data };
  });
