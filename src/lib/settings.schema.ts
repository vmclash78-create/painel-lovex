import { z } from "zod";

export const SettingsSchema = z.object({
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
