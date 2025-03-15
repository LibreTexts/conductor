import { z } from "zod";
import { checkBookIDFormat } from "../../util/bookutils.js";
import conductorErrors from "../../conductor-errors.js";
import { query } from "express";

// Book ID format: library-pageid (e.g. "chem-123")
export const bookIDSchema = z.string().regex(/^[a-zA-Z]{2,12}-\d{1,12}$/, {
  message: "Book ID must be in the format 'library-pageid' (e.g. 'chem-123')",
});

export const createBookSchema = z.object({
  body: z.object({
    library: z.coerce.number().positive().int(),
    title: z.string().min(1).max(255),
    projectID: z.string().length(10),
  }),
});

export const getCommonsCatalogSchema = z.object({
  query: z.object({
    activePage: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(10),
    sort: z
      .union([z.literal("title"), z.literal("author"), z.literal("random")])
      .optional()
      .default("title"),
  }),
});

export const getMasterCatalogSchema = z.object({
  query: z.object({
    sort: z
      .union([z.literal("title"), z.literal("author"), z.literal("random")])
      .optional()
      .default("title"),
    search: z.string().min(1).optional(),
  }),
});

export const getWithBookIDParamSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
});

export const getWithBookIDBodySchema = z.object({
  body: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
});

export const getBookFilesSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
    fileID: z.string().uuid().optional(),
  }),
});

export const downloadBookFileSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
    fileID: z.string().uuid(),
  }),
});

export const deleteBookSchema = z.intersection(
  z.object({
    query: z.object({
      deleteProject: z.coerce.boolean().optional(),
    }),
  }),
  getWithBookIDParamSchema
);

// Uses the same ID format as getWithBookIDParamSchema
export const getWithPageIDParamSchema = z.object({
  params: z.object({
    pageID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
});

export const getWithPageIDParamAndCoverPageIDSchema = z.object({
  params: z.object({
    pageID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
  query: z.object({
    coverPageID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
});

export const updatePageDetailsSchema = z.object({
  params: z.object({
    pageID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
  body: z.object({
    summary: z.string().optional(),
    tags: z.array(z.string()).max(100).optional(),
  }),
  query: z.object({
    coverPageID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
});

// If a resource type is specified, the overwrite option must also be specified
const _resourceTypeSchema = z
  .object({
    generate: z.coerce.boolean(),
    overwrite: z.coerce.boolean(),
  })
  .optional();

// For AI-generated metadata
export const batchGenerateAIMetadataSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
  body: z
    .object({
      summaries: _resourceTypeSchema,
      tags: _resourceTypeSchema,
      alttext: _resourceTypeSchema,
    })
    .refine(
      (data) =>
        data.summaries?.generate ||
        data.tags?.generate ||
        data.alttext?.generate,
      {
        message:
          "At least one of 'summaries', 'tags', or 'alttext'  must be true",
      }
    ),
});

// For user-defined metadata
export const batchUpdateBookMetadataSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
  body: z.object({
    pages: z.array(
      z.object({
        id: z.string(),
        summary: z.string().max(550).optional(), // Technically anything past 500 is truncated by MindTouch, but allow for some buffer
        tags: z.array(z.string().max(255)).max(100).optional(),
      })
    ),
  }),
});

const _ReducedPageSimpleWTagsSchema = z.array(
  z.object({
    id: z.string(),
    tags: z.array(z.string()),
  })
);

export const bulkUpdatePageTagsSchema = z.object({
  params: z.object({
    bookID: z.string().refine(checkBookIDFormat, {
      message: conductorErrors.err1,
    }),
  }),
  body: z.object({
    pages: _ReducedPageSimpleWTagsSchema,
  }),
});

export const GeneratePageImagesAltTextSchema =
  getWithPageIDParamAndCoverPageIDSchema.merge(
    z.object({
      body: z.object({
        overwrite: z.coerce.boolean(),
      }),
    })
  );
