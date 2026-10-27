import { z } from "zod";
import conductorErrors from "../../conductor-errors.js";
import { PaginationSchema, SortDirection } from "./misc.js";

/**
 * Conductor-side activity identifier, as produced by `b62(8)`.
 */
const activityIDSchema = z.string().length(8, { message: conductorErrors.err1 });

/**
 * The H5P content id.
 *
 * Accepted as a path parameter because it is the identifier published embeds and
 * ADAPT already use. Coerced because it always arrives as a string on the wire,
 * and bounded to a positive integer so a malformed embed URL fails validation
 * rather than reaching a query.
 */
const h5pContentIDSchema = z.coerce
  .number()
  .int()
  .positive({ message: conductorErrors.err1 });

const activityIDParamsSchema = z.object({
  activityID: activityIDSchema,
});

const h5pContentIDParamsSchema = z.object({
  h5pContentID: h5pContentIDSchema,
});

/**
 * Shared listing controls. `library` filters by H5P content type, which is the
 * facet Studio's `/library` page exposed as its "H5P Type" checkbox group.
 */
const listActivitiesQuerySchema = z.intersection(
  z.object({
    query: z
      .string()
      .max(100, { message: conductorErrors.err1 })
      .or(z.literal(""))
      .optional(),
    library: z.string().max(100, { message: conductorErrors.err1 }).optional(),
    subject: z.string().max(100, { message: conductorErrors.err1 }).optional(),
    license: z.string().max(100, { message: conductorErrors.err1 }).optional(),
    sort: z.enum(["title", "updated", "created"]).optional().default("updated"),
    sortDirection: SortDirection.optional().default("descending"),
  }),
  PaginationSchema
);

export const getCommonsActivitiesSchema = z.object({
  query: listActivitiesQuerySchema,
});

export const getActivitySchema = z.object({
  params: activityIDParamsSchema,
});

/**
 * Resolves an activity by the identifier baked into published embeds.
 */
export const getActivityByH5PIDSchema = z.object({
  params: h5pContentIDParamsSchema,
});

export const getActivitiesByAuthorSchema = z.object({
  params: z.object({
    uuid: z.string().uuid({ message: conductorErrors.err1 }),
  }),
  query: PaginationSchema,
});

/**
 * The ADAPT reconciliation feed.
 *
 * Studio served this as an unpaginated CSV over every H5P node regardless of
 * publication state, and ADAPT consumes it that way, so the schema deliberately
 * exposes no pagination or filtering. `format` exists only so the endpoint can
 * also be read as JSON during cutover verification; it defaults to the CSV that
 * ADAPT expects.
 */
export const getAdaptFeedSchema = z.object({
  query: z.object({
    format: z.enum(["csv", "json"]).optional().default("csv"),
  }),
});
