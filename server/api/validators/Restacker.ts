import { z } from "zod";


export const GetRestackerPageSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});

export const UpdateRestackerLicenseSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    pageID: z.string().min(1),
    license: z.string(),
    version: z.string().optional(),
    force: z.boolean().optional(),
  }),
});

export const BulkUpdateRestackerLicenseSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z.object({
    pageIDs: z.array(z.string().min(1)).min(1).max(5000),
    license: z.string(),
    version: z.string().optional(),
  }),
});

export const RestackerReloadSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
  body: z
    .object({
      mode: z.enum(["content", "page"]).optional(),
    })
    .optional(),
});
