import { z } from "zod";

export const NewUserWebhookValidator = z.object({
  body: z.object({
    central_identity_id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    avatar: z.string().url().optional(),
  }),
});
