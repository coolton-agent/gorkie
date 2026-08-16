import { z } from 'zod';

export const userSettingsSchema = z.object({
  instructions: z.string().min(1).max(4000).optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
