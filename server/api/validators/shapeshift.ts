import { z } from "zod";

export const CreateJobValidator = z.object({
  body: z.object({
    highPriority: z.boolean().optional(),
    url: z.url(),
  }),
});

export const GetOpenJobsValidator = z.object({
  query: z.object({
    status: z.enum(['created', 'inprogress', 'failed']).optional(),
    sort: z.enum(['asc', 'desc']).default('desc'),
  }),
});
