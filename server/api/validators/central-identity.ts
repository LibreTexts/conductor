import { z } from "zod";
import { PaginationSchema } from "./misc.js";

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

export const ChangeUserPasswordValidator = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: z.object({
    new_password: z.string().min(8).max(128),
  }),
});


export const CheckUserApplicationAccessValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
    applicationId: z.coerce.number().positive().int()
  }),
});

export const CheckUsersApplicationAccessValidator = z.object({
  params: z.object({
    applicationId: z.union([z.coerce.number().positive().int(), z.string()])
  }),
  body: z.object({
    ids: z.array(z.string().uuid()),
  })
});


export const GetVerificationRequestsSchema = z.object({
  query: z.object({
    status: z.enum(["open", "closed"]).optional()
  }).merge(PaginationSchema),
});

export const DeleteUserValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const LifecycleEventWebhookValidator = z.object({
  body: z.object({
    payload: z.jwt({ alg: "HS256" }), // raw JWT string remains in body after authLibreOneLifecycleWebhook middleware 
    lifecycleWebhookProtectedHeader: z.object({
      alg: z.string(),
      typ: z.string(),
    }),
    lifecycleWebhookPayload: z.object({
      event: z.string(),
      payload: z.record(z.string(), z.any()),
    }).refine((data) => {
      if (typeof data.event !== "string" || typeof data.payload !== "object") {
        return false;
      }

      // Do basic validation for at least the fields we actually consume
      if (data.event === "user:created" || data.event === "user:updated") {
        // TODO: convert this to a reusable Zod schema for validating and Central Identity user object
        const valid = z.safeParse(z.object({
          uuid: z.uuid(),
          first_name: z.string().min(1).max(255),
          last_name: z.string().min(1).max(255),
          email: z.email(),
          avatar: z.url().optional().or(z.literal(null)),
          user_type: z.enum(["student", "instructor"]),
          verify_status: z.string().or(z.literal(null)),
        }), data.payload)

        if (!valid.success) {
          return false;
        }
      }

      return true;
    }),
  }),
});