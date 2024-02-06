import { z } from "zod";

const TicketUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

export const GetTicketValidator = TicketUUIDParams;
export const DeleteTicketValidator = TicketUUIDParams;
export const GetUserTicketsValidator = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status"]).optional(),
  }),
});
export const GetAssignableUsersValidator = TicketUUIDParams;

export const CreateTicketValidator = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000),
    apps: z.array(z.number()).optional(),
    priority: z.enum(["low", "medium", "high"]),
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
  }),
});

export const AddTicketAttachementsValidator = TicketUUIDParams;

export const UpdateTicketValidator = z
  .object({
    body: z.object({
      priority: z.enum(["low", "medium", "high"]),
      status: z.enum(["open", "in_progress", "closed"]),
    }),
  })
  .merge(TicketUUIDParams);

export const SearchTicketsValidator = z.object({
  query: z.object({
    query: z.string().min(3),
  }),
});

export const GetOpenTicketsValidator = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).optional(),
    sort: z.enum(["opened", "priority", "status"]).optional(),
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
      assigned: z.array(z.string().uuid()).min(1).max(25),
    }),
  })
  .merge(TicketUUIDParams);

export const SendTicketMessageValidator = z
  .object({
    body: z.object({
      message: z.string().trim().min(1).max(1000),
      attachments: z.array(z.string()).optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const GetTicketAttachmentValidator = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    attachmentUUID: z.string().uuid(),
  }),
});
