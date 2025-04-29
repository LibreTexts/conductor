import { z } from "zod";

export const GetLibraryFromSubdomainSchema = z.object({
  params: z.object({
    subdomain: z.string(),
  }),
  query: z.object({
    includeHidden: z.coerce.boolean().optional(),
  }),
});
