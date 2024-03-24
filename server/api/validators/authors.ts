import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

const _AuthorValidator = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().optional().or(z.literal("")),
  url: z.string().url().optional().or(z.literal("")),
  primaryInstitution: z.string().trim().optional().or(z.literal("")),
  userUUID: z.string().uuid().optional(),
});

const AuthorIDParams = z.object({
  params: z.object({
    id: z.string().refine((val: string) => isMongoIDValidator(val)),
  }),
});

export const GetAllAuthorsValidator = z.object({
  query: z
    .object({
      query: z.string().optional(),
      sort: z.enum(["firstName", "lastName", "email"]).optional(),
    })
    .merge(PaginationSchema),
});

export const GetAuthorValidator = AuthorIDParams;

export const CreateAuthorValidator = z.object({
  body: _AuthorValidator.merge(z.object({
    isAdminEntry: z.boolean().optional().default(false)
  }))
});

export const UpdateAuthorValidator =
  CreateAuthorValidator.merge(AuthorIDParams);

export const DeleteAuthorValidator = AuthorIDParams;

export const BulkCreateAuthorsValidator = z.object({
  body: z.object({
    authors: z.array(_AuthorValidator).min(1).max(1500),
  }),
});
