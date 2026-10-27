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
 * The signed-in user's own activities, for My H5P.
 *
 * `visibility` uses the three levels the UI shows, which map onto the stored
 * fields: public = public and in the library, unlisted = public and not in the
 * library, private = private.
 */
export const getMyActivitiesSchema = z.object({
  query: z.intersection(
    z.object({
      query: z
        .string()
        .max(100, { message: conductorErrors.err1 })
        .or(z.literal(""))
        .optional(),
      visibility: z.enum(["all", "public", "unlisted", "private"]).optional().default("all"),
      sort: z.enum(["updated", "title", "created"]).optional().default("updated"),
    }),
    PaginationSchema.extend({
      limit: z.coerce.number().int().min(1).max(100).default(24),
    })
  ),
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

/**
 * Metadata an author edits on the create/edit screen. Every field optional,
 * so update can send only what changed. `visibility` is the UI's three
 * levels; see `getMyActivitiesSchema` for how they map onto stored fields.
 */
const activityMetadataSchema = z.object({
  title: z.string().trim().min(1, { message: conductorErrors.err1 }).max(255, { message: conductorErrors.err1 }).optional(),
  description: z.string().max(10000, { message: conductorErrors.err1 }).optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(10, { message: conductorErrors.err1 }).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(30, { message: conductorErrors.err1 }).optional(),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { message: conductorErrors.err1 }).optional(),
  publisher: z.string().max(255, { message: conductorErrors.err1 }).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  license: z
    .object({
      name: z.string().min(1).max(32),
      version: z.string().max(10).optional(),
      additionalTerms: z.string().max(2000).optional(),
    })
    .optional(),
});

export const createActivitySchema = z.object({
  body: activityMetadataSchema,
});

/**
 * `contentSaved` carries what the H5P editor reported after a successful
 * save (its `saved` message), so the Activity's title, content type and
 * license follow the content. Sending it also clears `pendingFirstSave`.
 */
export const updateActivitySchema = z.object({
  params: activityIDParamsSchema,
  body: activityMetadataSchema.extend({
    contentSaved: z
      .object({
        title: z.string().trim().min(1).max(255),
        library: z.string().regex(/^[A-Za-z][\w.-]* \d+\.\d+$/, { message: conductorErrors.err1 }),
        libraryTitle: z.string().trim().min(1).max(255).optional(),
        license: z.string().max(32).optional(),
        licenseVersion: z.string().max(10).optional(),
        authors: z
          .array(z.object({ name: z.string().max(255), role: z.string().max(64).optional() }).passthrough())
          .max(50)
          .optional(),
      })
      .optional(),
  }),
});

export const activityIDOnlySchema = z.object({
  params: activityIDParamsSchema,
});
