import { z } from "zod";
import { NAME_KEY_LOOKUP_REGEX } from "./authors.js";

const projectParams = z.object({
  projectID: z.string().length(10),
});

// The key of an existing author, or null to clear the page's author. Uses the lookup format so
// authors whose keys predate the stricter write format can still be assigned.
const authorKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(NAME_KEY_LOOKUP_REGEX, { message: "Invalid author key." })
  .nullable();

export const GetAuthorshipSchema = z.object({
  params: projectParams,
});

export const AuthorshipReloadSchema = z.object({
  params: projectParams,
});

export const UpdateAuthorshipAuthorSchema = z.object({
  params: projectParams,
  body: z.object({
    pageID: z.string().min(1),
    authorKey: authorKeySchema,
  }),
});

export const BulkUpdateAuthorshipAuthorSchema = z.object({
  params: projectParams,
  body: z.object({
    pageIDs: z.array(z.string().min(1)).min(1).max(5000),
    authorKey: authorKeySchema,
  }),
});
