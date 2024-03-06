import { z } from "zod";
import { PaginationSchema } from "./misc.js";

export const getPublicProjectsSchema = z.object({
  query: PaginationSchema,
});

export const GetAddableTeamMembersSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  query: z.object({
    search: z.string().min(1).max(50).or(z.literal("")).optional(),
    includeOutsideOrg: z.coerce.boolean().optional(),
  }).merge(PaginationSchema)
});
