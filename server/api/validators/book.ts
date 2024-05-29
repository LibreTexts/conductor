import { z } from "zod";
import { checkBookIDFormat } from "../../util/bookutils";
import conductorErrors from "../../conductor-errors";

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

 