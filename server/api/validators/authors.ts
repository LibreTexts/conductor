import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

const AuthorIDParams = z.object({
  params: z.object({
    id: z.string().refine((val: string) => isMongoIDValidator(val)),
  }),
});

export const GetAllAuthorsValidator = z.object({
  query: z
    .object({
      search: z.string().optional(),
      sort: z.enum(["firstName", "lastName", "email"]).optional(),
    })
    .merge(PaginationSchema),
});

export const GetAuthorValidator = AuthorIDParams;

export const CreateAuthorValidator = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().optional(),
    url: z.string().url().optional(),
    primaryInstitution: z.string().trim().optional(),
    userUUID: z.string().uuid().optional(),
  }),
});

export const UpdateAuthorValidator =
  CreateAuthorValidator.merge(AuthorIDParams);

export const DeleteAuthorValidator = AuthorIDParams;
