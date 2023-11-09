import { z } from "zod";
import {
  projectSortOptions,
  bookSortOptions,
  homeworkSortOptions,
  userSortOptions,
} from "../search.js";

export const conductorSearchSchema = z.object({
  query: z.object({
    searchQuery: z.string().min(1).max(200),
    projLocation: z.enum(["global", "local"]).optional(),
    projStatus: z.enum(["any", "completed", "available", "open"]).optional(),
    projVisibility: z.enum(["any", "private", "public"]).optional(),
    projSort: z.enum(projectSortOptions).optional(),
    bookSort: z.enum(bookSortOptions).optional(),
    hwSort: z.enum(homeworkSortOptions).optional(),
    userSort: z.enum(userSortOptions).optional(),
  }),
});
