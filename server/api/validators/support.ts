import { z } from "zod";

const TicketUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

const TicketPriority = z.enum(["low", "medium", "high", "severe"]);

export const GetTicketValidator = TicketUUIDParams;
export const DeleteTicketValidator = TicketUUIDParams;
export const GetUserTicketsValidator = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status"]).optional(),
  }),
});

export const GetRequestorOtherTicketsValidator = z.object({
  query: z
    .object({
      email: z.string().email().or(z.literal("")).optional(),
      uuid: z.string().uuid().or(z.literal("")).optional(),
      currentTicketUUID: z.string().uuid().optional(),
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).optional(),
      sort: z.enum(["opened", "priority", "status"]).optional(),
    })
    .refine((data) => {
      if (!data.email && !data.uuid) {
        return false;
      }
      return true;
    }, "At least one of email or uuid is required"),
});

export const CreateTicketValidator = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000),
    apps: z.array(z.number()).optional(),
    priority: TicketPriority,
    category: z.string(),
    capturedURL: z.string().url().optional(),
    attachments: z.array(z.string()).optional(),
    guest: z
      .object({
        firstName: z.string().trim().min(1).max(255),
        lastName: z.string().trim().min(1).max(255),
        email: z.string().trim().email(),
        organization: z.string().trim().min(1).max(255),
      })
      .optional(),
    deviceInfo: z
      .object({
        userAgent: z.string().optional(),
        language: z.string().optional(),
        screenResolution: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .optional(),
  }),
});

export const AddTicketAttachementsValidator = z
  .object({
    query: z.object({
      accessKey: z.string().optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const UpdateTicketValidator = z
  .object({
    body: z.object({
      priority: TicketPriority,
      status: z.enum(["open", "in_progress", "closed"]),
      autoCloseSilenced: z.boolean().optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const GetOpenTicketsValidator = z.object({
  query: z.object({
    query: z.string().min(3).or(z.literal("")).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status", "category"]).optional(),
    assignee: z.string().uuid().or(z.literal("")).optional(),
    category: z.string().or(z.literal("")).optional(),
    priority: TicketPriority.or(z.literal("")).optional(),
  }),
});

export const GetClosedTicketsValidator = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "closed", "priority"]).optional(),
  }),
});

export const AssignTicketValidator = z
  .object({
    body: z.object({
      assigned: z.array(z.string().uuid()).min(0).max(25),
    }),
  })
  .merge(TicketUUIDParams);

export const AddTicketCCValidator = z
  .object({
    body: z.object({
      email: z.string().email(),
    }),
  })
  .merge(TicketUUIDParams);

export const RemoveTicketCCValidator = z
  .object({
    body: z.object({
      email: z.string().email(),
    }),
  })
  .merge(TicketUUIDParams);

export const SendTicketMessageValidator = z
  .object({
    body: z.object({
      message: z.string().trim().min(1).max(3000),
      attachments: z.array(z.string()).optional(),
    }),
    query: z.object({
      accessKey: z.string().optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const GetTicketAttachmentValidator = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    attachmentUUID: z.string().uuid(),
  }),
});
