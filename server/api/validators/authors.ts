import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

const _AuthorValidator = z.object({
  nameKey: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  nameTitle: z.string().trim().max(50).optional().or(z.literal("")),
  nameURL: z.url().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  noteURL: z.url().optional().or(z.literal("")),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  companyURL: z.url().optional().or(z.literal("")),
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
      sort: z.enum(["nameKey", "name", "companyName"]).optional().default("nameKey"),
    }).optional().default({ page: 1, limit: 25, sort: "nameKey" }),
});

export const GetAuthorValidator = AuthorIDParams;

export const GetAuthorByNameKeyValidator = z.object({
  params: z.object({
    key: z.string().trim().min(1).max(100),
  }),
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

export const GetCXOnePageContentTemplateValidator = z.object({
  params: z.object({
    type: z.enum(["header", "footer"]),
  }),
});