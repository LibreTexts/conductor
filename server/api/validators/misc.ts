import { z } from "zod";

export const isUUID = (value: string) =>
  z.string().uuid().safeParse(value).success;

/**
 * Reusable pagination schema (generally merged with query schema)
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(10),
});
