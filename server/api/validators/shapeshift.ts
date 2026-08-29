import { z } from "zod";
import { bookIDSchema } from "./book.js";

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


/**
 * Book-scoped routes are addressed by bookID and authorized against the Project
 * that owns the book, so the path param is all they take.
 */
export const BookScopedValidator = z.object({
  params: z.object({
    bookID: bookIDSchema,
  }),
});

export const WebhookValidator = z.object({
  body: z.object({
    bookID: bookIDSchema,
    contentPageCount: z.number().int().nonnegative().optional(),
    timestamp: z.number().int().nonnegative(), // Unix timestamp in milliseconds
  }),
});
