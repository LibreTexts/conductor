import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

export const getPublicProjectsSchema = z.object({
  query: PaginationSchema,
});