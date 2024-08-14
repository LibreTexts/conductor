import { z } from 'zod';
import { checkBookIDFormat } from '../../util/bookutils.js';
import conductorErrors from '../../conductor-errors.js';
import { PaginationSchema, SortDirection } from './misc.js';

const collIDOrTitleSchema = z.string().max(150, { message: conductorErrors.err1 });
const strictCollIDSchema = z.string().length(8, { message: conductorErrors.err1 });
const collectionIDOrTitleParamsSchema = z.object({
  collID: collIDOrTitleSchema,
});
const strictCollectionIDParamsSchema = z.object({
  collID: strictCollIDSchema,
});

const collectionsLocations = z.enum(['campus', 'central'])
const collectionLocationsSchema = z.array(collectionsLocations).optional();

const collectionPrivacySchema = z.enum(['public', 'private', 'campus']).or(z.literal(""))
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
  body: z.object({
    autoManage: z.coerce.boolean().optional(),
    coverPhoto: z.string().or(z.literal("")).or(z.literal("")).optional(),
    locations: collectionLocationsSchema,
    parentID: z.string().length(8, { message: conductorErrors.err1 }).optional(),
    privacy: collectionPrivacySchema.optional(),
    program: z.string().or(z.literal("")).optional(),
    title: z.string().min(3, { message: conductorErrors.err1 }),
  }),
});

export const deleteCollectionSchema = z.object({
  params: strictCollectionIDParamsSchema,
});

export const editCollectionSchema = z.object({
  body: z.object({
    autoManage: z.coerce.boolean().optional(),
    locations: collectionLocationsSchema,
    parentID: z.string().length(8, { message: conductorErrors.err1 }).or(z.literal("")).optional(),
    privacy: collectionPrivacySchema.optional(),
    program: z.string().or(z.literal("")).optional(),
    title: z.string().min(3, { message: conductorErrors.err1 }).optional(),
  }),
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
