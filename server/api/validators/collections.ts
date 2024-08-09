import { z } from 'zod';
import { checkBookIDFormat } from '../../util/bookutils';
import conductorErrors from '../../conductor-errors';
import { PaginationSchema, SortDirection } from './misc';

const collIDOrTitleSchema = z.string().max(150, { message: conductorErrors.err1 });
const strictCollIDSchema = z.string().length(8, { message: conductorErrors.err1 });
const collectionIDOrTitleParamsSchema = z.object({
  collID: collIDOrTitleSchema,
});
const strictCollectionIDParamsSchema = z.object({
  collID: strictCollIDSchema,
});
const collectionsLocations = ['campus', 'central'];
const collectionLocationsSchema = z.enum(collectionsLocations as [string, ...string[]]);

const collectionPrivacySchema = z.enum(['public', 'private', 'campus']);
const getCollectionsSharedSchema = z.intersection(z.object({
  detailed: z.boolean().optional(),
  query: z.string().max(100, { message: conductorErrors.err1 }).optional(),
  sort: z.enum(['program', 'title']).optional().default('title'),
  sortDirection: SortDirection.optional().default('ascending'),

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
    autoManage: z.boolean().optional(),
    coverPhoto: z.string().or(z.literal("")).optional(),
    locations: z.array(collectionLocationsSchema).optional(),
    parentID: z.string().length(8, { message: conductorErrors.err1 }).optional(),
    privacy: collectionPrivacySchema.optional(),
    program: z.string().optional(),
    title: z.string().min(3, { message: conductorErrors.err1 }),
  }),
});

export const deleteCollectionSchema = z.object({
  params: strictCollectionIDParamsSchema,
});

export const editCollectionSchema = z.object({
  body: z.object({
    autoManage: z.boolean().optional(),
    locations: collectionLocationsSchema.optional(),
    parentID: z.string().length(8, { message: conductorErrors.err1 }).optional(),
    privacy: collectionPrivacySchema.optional(),
    program: z.string().optional(),
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
    query: z.string().max(100, { message: conductorErrors.err1 }).optional(),
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
