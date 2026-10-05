import { z } from 'zod';
import { checkBookIDFormat } from '../../util/bookutils.js';
import conductorErrors from '../../conductor-errors.js';
import { PaginationSchema, SortDirection } from './misc.js';
import collectionLimits from '../../../shared/collection-limits.json';

/**
 * Shelf ceiling, shared with the client's shelf picker so the dialog enforces
 * the same number this schema rejects on. A client cap that drifted below this
 * one would make shelves unselectable for no visible reason; above it, the save
 * would fail after the admin had already picked them.
 */
const MAX_SYNC_SHELVES = collectionLimits.maxSyncShelves;

const collIDOrTitleSchema = z.string().max(150, { message: conductorErrors.err1 });
const strictCollIDSchema = z.string().length(8, { message: conductorErrors.err1 });
const collectionIDOrTitleParamsSchema = z.object({
  collID: collIDOrTitleSchema,
});
const strictCollectionIDParamsSchema = z.object({
  collID: strictCollIDSchema,
});

const collectionPrivacySchema = z.enum(['public', 'private', 'campus']).or(z.literal(""))

/**
 * How an auto-managed Collection selects its Books.
 *
 * `shelves` is the only configurable mode. The stored `program` mode is being
 * retired: the Collections already using it keep syncing, but accepting it here
 * would let a new Collection be created on it or an existing one be moved onto
 * it, which is exactly what the offramp is meant to prevent.
 */
const collectionSyncModeSchema = z.enum(['shelves']);

/**
 * Library shelves an auto-managed Collection draws from. Paths are
 * library-relative, as the shelf picker returns them.
 */
const collectionSyncShelvesSchema = z
  .array(
    z.object({
      library: z.string().min(1).max(50),
      path: z
        .string()
        .min(1)
        .max(500)
        .transform((path) => path.replace(/^\/+|\/+$/g, ''))
        .refine((path) => path.length > 0 && !path.split('/').includes('..'), {
          message: conductorErrors.err1,
        }),
    })
  )
  .max(MAX_SYNC_SHELVES, {
    message: `A collection can sync from at most ${MAX_SYNC_SHELVES} shelves.`,
  })
  .optional();

/**
 * Refuses an auto-managed Collection with nothing to match on.
 *
 * An empty config would otherwise be saved and then quietly skipped by the sync,
 * leaving the admin with a collection that never fills and no explanation.
 *
 * `syncMode` absent on an edit means "don't touch the sync rule" — a legacy
 * program Collection having its title or description changed. There is nothing
 * to validate in that case: the handler writes none of these fields.
 */
const requireUsableSyncConfig = (
  body: {
    autoManage?: boolean;
    syncMode?: 'shelves';
    syncShelves?: { library: string; path: string }[];
  },
  ctx: z.RefinementCtx
) => {
  if (!body.autoManage || !body.syncMode) return;

  if (!body.syncShelves || body.syncShelves.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['syncShelves'],
      message: 'At least one shelf is required.',
    });
  }
};
const getCollectionsSharedSchema = z.intersection(z.object({
  detailed: z.coerce.boolean().optional(),
  query: z.string().max(100, { message: conductorErrors.err1 }).optional(),
  sort: z.enum(['program', 'title']).optional().default('title'),
  sortDirection: SortDirection.optional().default('descending'),

}), PaginationSchema);

export const addCollectionResourceSchema = z.object({
  params: strictCollectionIDParamsSchema,
  body: z.object({
    books: z.array(z.string().refine((v) => checkBookIDFormat(v), {
      message: conductorErrors.err1,
    })),
  }),
});

export const createCollectionSchema = z.object({
  body: z
    .object({
      autoManage: z.coerce.boolean().optional(),
      coverPhoto: z.string().or(z.literal("")).or(z.literal("")).optional(),
      parentID: z.string().length(8, { message: conductorErrors.err1 }).optional(),
      privacy: collectionPrivacySchema.optional(),
      // Shelves is the only mode a new Collection can have, so it is the default
      // rather than something the client has to assert.
      syncMode: collectionSyncModeSchema.default('shelves'),
      syncShelves: collectionSyncShelvesSchema,
      title: z.string().min(3, { message: conductorErrors.err1 }),
      description: z.string().max(1000).or(z.literal("")).optional(),
    })
    .superRefine(requireUsableSyncConfig),
});

export const deleteCollectionSchema = z.object({
  params: strictCollectionIDParamsSchema,
});

export const editCollectionSchema = z.object({
  body: z
    .object({
      autoManage: z.coerce.boolean().optional(),
      parentID: z.string().length(8, { message: conductorErrors.err1 }).or(z.literal("")).optional(),
      privacy: collectionPrivacySchema.optional(),
      // Absent means "leave the sync rule alone", which is how a legacy program
      // Collection is edited without being dragged off its rule. `program` and
      // `locations` are deliberately absent from this schema: validateZod strips
      // unknown keys, so a client that still sends them cannot overwrite the
      // stored values.
      syncMode: collectionSyncModeSchema.optional(),
      syncShelves: collectionSyncShelvesSchema,
      title: z.string().min(3, { message: conductorErrors.err1 }).optional(),
      description: z.string().max(1000).or(z.literal("")).optional(),
    })
    .superRefine(requireUsableSyncConfig),
  params: strictCollectionIDParamsSchema,
});

export const getAllCollectionsSchema = z.object({
  query: getCollectionsSharedSchema,
});

export const getCommonsCollectionsSchema = z.object({
  query: getCollectionsSharedSchema,
});

export const getCollectionSchema = z.object({
  params: collectionIDOrTitleParamsSchema,
});

export const getCollectionResourcesSchema = z.object({
  query: z.intersection(z.object({
    query: z.string().max(100, { message: conductorErrors.err1 }).or(z.literal("")).optional(),
    sort: z.enum(['resourceType', 'title', 'author']).optional().default('title'),
    sortDirection: SortDirection.optional().default('ascending'),
  }), PaginationSchema),
  params: collectionIDOrTitleParamsSchema,
});

export const removeCollectionResourceSchema = z.object({
  params: z.intersection(strictCollectionIDParamsSchema, z.object({
    resourceID: z.union([
      strictCollIDSchema,
      z.string().refine((v) => checkBookIDFormat(v), {
        message: conductorErrors.err1,
      }),
    ]),
  })),
});

export const updateCollectionImageAssetSchema = z.object({
  params: z.object({
    assetName: z.enum(['coverPhoto']),
    collID: strictCollIDSchema,
  }),
});
