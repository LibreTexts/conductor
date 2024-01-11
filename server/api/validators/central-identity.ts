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

export const LibraryAccessWebhookValidator = z.object({
  body: z.object({
    central_identity_id: z.string().uuid(),
    library: z.string(),
  }),
});

export const CheckUserApplicationAccessValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
    applicationId: z.coerce.number().positive().int(),
  }),
});
