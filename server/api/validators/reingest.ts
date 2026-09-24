import { z } from "zod";

/**
 * Params for the on-demand Benny re-ingest proxy.
 * bookID is `${library}-${coverPageID}`; pageID is the CXOne page id.
 */
export const reingestPageSchema = z.object({
  params: z.object({
    bookID: z.string().min(1),
    pageID: z.string().min(1),
  }),
});
