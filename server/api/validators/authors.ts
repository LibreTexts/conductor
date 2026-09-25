import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

// Writes take the strict pattern; the lookup route takes the permissive one so keys
// inserted directly by a migration (which bypasses this schema) stay retrievable.
export const NAME_KEY_REGEX = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
export const NAME_KEY_LOOKUP_REGEX = /^[a-z0-9_-]{1,100}$/;

const NAME_KEY_MESSAGE =
  "Name Key must be lowercase letters, numbers, hyphens, and underscores only.";

const nameKeySchema = z.string().trim().min(1).max(100).regex(NAME_KEY_REGEX, {
  message: NAME_KEY_MESSAGE,
});

const nameKeyLookupSchema = z.string().trim().min(1).max(100).regex(NAME_KEY_LOOKUP_REGEX, {
  message: NAME_KEY_MESSAGE,
});

const _AuthorValidator = z.object({
  nameKey: nameKeySchema,
  name: z.string().trim().min(1).max(200),
  nameURL: z.url().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  noteURL: z.url().optional().or(z.literal("")),
  campusName: z.string().trim().max(200).optional().or(z.literal("")),
  campusURL: z.url().optional().or(z.literal("")),
  pictureCircle: z.enum(["yes", "no"]).optional(),
  pictureURL: z.url().optional().or(z.literal("")),
  programName: z.string().trim().max(200).optional().or(z.literal("")),
  programURL: z.url().optional().or(z.literal("")),
  attributionPrefix: z.string().trim().max(100).optional().or(z.literal("")),
  userUUID: z.uuid().optional(),
});

const AuthorIDParams = z.object({
  params: z.object({
    id: z.string().refine((val: string) => isMongoIDValidator(val)),
  }),
});

export const GetAuthorsValidator = z.object({
  query: z
    .object({
      page: z.coerce.number().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).optional().default(25),
      query: z.string().optional().or(z.literal("")),
      sort: z.enum(["nameKey", "name", "campusName"]).optional().default("nameKey"),
    }).optional().default({ page: 1, limit: 25, sort: "nameKey" }),
});

export const GetAuthorValidator = AuthorIDParams;

export const GetAuthorByNameKeyValidator = z.object({
  params: z.object({
    key: nameKeyLookupSchema,
  }),
  query: z.object({
    includeProjects: z.coerce.boolean().optional().default(false),
  }).optional().default({ includeProjects: false }),
});

export const GetAuthorAssetsValidator = z.object({
  params: z.object({
    id: z.string().refine((val: string) => isMongoIDValidator(val)),
  }),
  query: PaginationSchema,
});

export const CreateAuthorValidator = z.object({
  body: _AuthorValidator,
});

export const UpdateAuthorValidator = z.object({
  body: _AuthorValidator.partial(),
  params: AuthorIDParams.shape.params,
});

export const DeleteAuthorValidator = AuthorIDParams;

export const UploadAuthorPictureValidator = AuthorIDParams;
