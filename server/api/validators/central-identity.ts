import { z } from "zod";
import { PaginationSchema } from "./misc";

export const NewUserWebhookValidator = z.object({
  body: z.object({
    central_identity_id: z.string().uuid(),
    first_name: z.string().min(1).max(255),
    last_name: z.string().min(1).max(255),
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

export const VerificationStatusUpdateWebhookValidator = z.object({
  body: z.object({
    central_identity_id: z.string().uuid(),
    verify_status: z.string(),
  }),
});

export const CheckUserApplicationAccessValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
    applicationId: z.coerce.number().positive().int(),
  }),
});


export const GetVerificationRequestsSchema = z.object({
  query: z.object({
    status: z.enum(["open", "closed"]).optional()
  }).merge(PaginationSchema),
});