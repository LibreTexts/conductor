import { z } from "zod";

export const TicketUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

const _TicketPriorityLevels = ["low", "medium", "high", "severe"] as const;
const TicketPriority = z.enum(_TicketPriorityLevels).optional();
const TicketStatus = z.enum(["open", "assigned", "in_progress", "awaiting_requester", "closed"]).optional();

export const GetTicketValidator = TicketUUIDParams;
export const DeleteTicketValidator = TicketUUIDParams;
export const GetUserTicketsValidator = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status"]).optional(),
    queue: z.string().min(1).optional(),
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
    title: z.string({
      message: "Title is required and must be between 1 and 200 characters",
    }).trim().min(1).max(200),
    queue_id: z.uuid().optional(), // will default to technical support queue if not provided
    description: z.string().trim().max(1000).or(z.literal("")),
    apps: z.array(z.coerce.number()).optional(),
    priority: TicketPriority,
    category: z.string().optional().or(z.literal("")),
    capturedURL: z.url().optional(),
    attachments: z.array(z.string({ message: "Invalid attachment URL" })).optional(),
    guest: z
      .object({
        firstName: z.string().trim().min(1).max(255),
        lastName: z.string().trim().min(1).max(255),
        email: z.email().trim(),
        organization: z.string().trim().min(1).max(255),
      }, {
        message: "Guest information is required if no authenticated user",
      })
      .optional(),
    deviceInfo: z
      .object({
        userAgent: z.string().optional(),
        language: z.string().optional(),
        screenResolution: z.string().optional(),
        timeZone: z.string().optional(),
      }, {
        message: "Device information is malformed",
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
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
      status: TicketStatus,
      autoCloseSilenced: z.boolean().optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const GetOpenTicketsValidator = z.object({
  query: z.object({
    queue: z.string().min(1),
    query: z.string().min(3).or(z.literal("")).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status", "category"]).optional(),
    assignee: z.array(z.string().uuid()).optional(),
    category: z.array(z.string()).optional(),
    priority: z.array(z.enum(_TicketPriorityLevels)).optional(),
    status: z.array(z.enum(["open", "assigned", "in_progress", "awaiting_requester"])).optional(),
  }),
});

export const GetClosedTicketsValidator = z.object({
  query: z.object({
    query: z.string().min(3).or(z.literal("")).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "category"]).optional(),
    assignee: z.array(z.string().uuid()).optional(),
    category: z.array(z.string()).optional(),
    priority: z.array(z.enum(_TicketPriorityLevels)).optional(),
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

export const BulkUpdateTicketsValidator = z.object({
  body: z.object({
    tickets: z.array(z.string().uuid()).min(1).max(100),
    queue: z.string().min(1).optional(),
    priority: TicketPriority.optional(),
    status: TicketStatus.optional(),
    assignee: z.array(z.string().uuid()).optional(),
  }),
});