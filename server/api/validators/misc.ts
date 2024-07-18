import { isObjectIdOrHexString } from "mongoose";
import { z } from "zod";

export function extractZodErrorMessages(
  validationResult: z.ZodError
): string[] {
  const errors: string[] = [];
  for (const error of validationResult.issues) {
    errors.push(error.message);
  }
  return errors;
}

export const isUUID = (value: string) =>
  z.string().uuid().safeParse(value).success;

export const isMongoIDValidator = (val: string) => isObjectIdOrHexString(val);

/**
 * Reusable pagination schema (generally merged with query schema)
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(10),
});

export const SortDirection = z.enum(['ascending', 'descending']);
