import { z } from "zod";
import { PaginationSchema } from "./misc.js";

export const assetTagSchema = z.object({
  key: z.string(),
  value: z.union([
    z.string().min(1),
    z.number(),
    z.boolean(),
    z.date(),
    z.array(z.string().min(1)),
  ]),
});

export const projectFileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  tags: z.array(assetTagSchema).optional(),
  license: z
    .object({
      name: z.string().trim().max(255).optional(),
      url: z.string().url().optional(),
      version: z.string().trim().max(255).optional(),
      sourceURL: z.string().url().optional(),
      modifiedFromSource: z.boolean().optional(),
      additionalTerms: z.string().trim().max(500).optional(),
    })
    .optional(),
  author: z
    .object({
      name: z.string().trim().max(255).optional(),
      email: z.string().email().optional(),
      url: z.string().url().optional(),
    })
    .optional(),
  publisher: z
    .object({
      name: z.string().trim().max(255).optional(),
      url: z.string().url().optional(),
    })
    .optional(),
});

export const updateProjectFileSchema = z.object({
  params: z.object({
    projectID: z.string().trim().min(10).max(10),
    fileID: z.string().uuid(),
  }),
  body: projectFileSchema,
});

export const getPublicProjectFilesSchema = z.object({
  query: PaginationSchema
})
