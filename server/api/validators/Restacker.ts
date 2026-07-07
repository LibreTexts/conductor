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