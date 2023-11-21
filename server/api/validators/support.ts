import { z } from "zod";

const TicketUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

export const GetTicketValidator = TicketUUIDParams;
export const DeleteTicketValidator = TicketUUIDParams;
export const GetUserTicketsValidator = TicketUUIDParams; // this is user uuid, but same validation..

export const CreateTicketValidator = z.object({
  body: z.object({
    title: z.string().max(200),
    description: z.string().max(1000),
    apps: z.array(z.number()).min(1),
    priority: z.enum(["low", "medium", "high"]),
    category: z.string(),
    capturedURL: z.string().url().optional(),
    attachments: z.array(z.string()).optional(),
    guest: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email(),
        organization: z.string(),
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
    page: z.number().min(1).optional(),
    limit: z.number().min(1).optional(),
  }),
})

export const StaffSendTicketMessageValidator = z
  .object({
    body: z.object({
      message: z.string(),
      attachments: z.array(z.string()).optional(),
    }),
  })
  .merge(TicketUUIDParams);

export const UserSendTicketMessageValidator = StaffSendTicketMessageValidator;
