import { z } from "zod";

export const CreateJobValidator = z.object({
  body: z.object({
    highPriority: z.boolean().optional(),
    url: z.url(),
  }),
});

export const GetJobsValidator = z.object({
  query: z.object({
    limit: z.coerce.number().int().nonnegative().default(100),
    offset: z.coerce.number().int().nonnegative().default(0),
    sort: z.enum(['asc', 'desc']).default('desc'),
    status: z
      .preprocess(
        (val) => (typeof val === 'string' ? val.split(',') : val),
        z.array(z.enum(['created', 'inprogress', 'failed', 'finished'])),
      )
      .optional(),
  }),
});
