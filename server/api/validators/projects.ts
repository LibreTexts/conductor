import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

export const assetTagSchema = z.object({
  key: z.string(),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.date(), z.array(z.string())])
    .optional(),
});

export const projectFileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  tags: z.array(assetTagSchema).optional(),
  license: z
    .object({
      name: z.string().trim().max(255).optional().or(z.literal("")),
      url: z.string().trim().url().optional().or(z.literal("")),
      version: z.string().trim().max(255).optional().or(z.literal("")),
      sourceURL: z.string().url().optional(),
      modifiedFromSource: z.boolean().optional(),
      additionalTerms: z.string().trim().max(500).optional(),
    })
    .optional(),
  authors: z.array(
    z
      .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: z.string().trim().email().optional().or(z.literal("")),
        url: z.string().url().optional().or(z.literal("")),
        primaryInstitution: z.string().trim().optional(),
      })
      .or(z.string().refine((val: string) => isMongoIDValidator(val)))
  ).optional(),
  publisher: z
    .object({
      name: z.string().trim().max(255).optional().or(z.literal("")),
      url: z.string().url().optional().or(z.literal("")),
    })
    .optional(),
  isURL: z.boolean().optional(),
  fileURL: z.string().url().optional(),
  overwriteName: z.coerce.boolean().optional(),
});

export const updateProjectFileSchema = z.object({
  params: z.object({
    projectID: z.string().trim().min(10).max(10),
    fileID: z.string().uuid(),
  }),
  body: projectFileSchema.partial(),
});

export const getPublicProjectFilesSchema = z.object({
  query: PaginationSchema,
});

export const getPublicProjectsSchema = z.object({
  query: PaginationSchema,
});
