import { z } from "zod";
import { NAME_KEY_LOOKUP_REGEX } from "./authors.js";
import { CREDIT_ROLES } from "../../util/author-tags.js";

const roleSchema = z.enum(CREDIT_ROLES);

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
  body: z
    .object({
      // "page" re-reads tags only and keeps the content data; "content" rescans everything.
      mode: z.enum(["content", "page"]).optional(),
    })
    .optional(),
});

// "set" replaces everyone in the role (the default, as before), "add" adds one person, and
// "remove" removes one tag value, which may be older plain text rather than a key.
const roleActionSchema = z.enum(["set", "add", "remove"]).optional().default("set");

// The value to remove can be any `<role>@` tag value, so it isn't held to the key format.
const removableValueSchema = z.string().trim().min(1).max(300);

const roleChangeBody = z
  .object({
    role: roleSchema,
    action: roleActionSchema,
    authorKey: removableValueSchema.nullable(),
  })
  .superRefine((body, ctx) => {
    if (body.action === "remove") {
      if (body.authorKey === null) {
        ctx.addIssue({ code: "custom", path: ["authorKey"], message: "Pick the person to remove." });
      }
      return;
    }
    if (body.action === "add" && body.authorKey === null) {
      ctx.addIssue({ code: "custom", path: ["authorKey"], message: "Pick the person to add." });
      return;
    }
    if (body.authorKey !== null && !authorKeySchema.safeParse(body.authorKey).success) {
      ctx.addIssue({ code: "custom", path: ["authorKey"], message: "Invalid author key." });
    }
  });

export const UpdateAuthorshipAuthorSchema = z.object({
  params: projectParams,
  body: z.intersection(z.object({ pageID: z.string().min(1) }), roleChangeBody),
});

export const BulkUpdateAuthorshipAuthorSchema = z.object({
  params: projectParams,
  body: z.intersection(
    z.object({ pageIDs: z.array(z.string().min(1)).min(1).max(5000) }),
    roleChangeBody,
  ),
});

// People to add per page and role, e.g. from the Quick Fix. Each item adds one person; a page
// and role can appear several times. Clearing and removing are not offered here.
export const AssignAuthorshipAuthorsSchema = z.object({
  params: projectParams,
  body: z.object({
    items: z
      .array(
        z.object({
          pageID: z.string().min(1),
          role: roleSchema,
          authorKey: authorKeySchema.unwrap(),
        }),
      )
      .min(1)
      .max(10000),
  }),
});

export const UpdateBookCreditSchema = z.object({
  params: projectParams,
  body: z.object({
    role: roleSchema,
    authorKey: authorKeySchema.unwrap(),
    action: z.enum(["add", "remove"]),
  }),
});

export const CompileBookCreditsSchema = z.object({
  params: projectParams,
  body: z
    .object({
      // false (the default) only previews the additions.
      apply: z.boolean().optional(),
    })
    .optional(),
});
