import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";

export const assetTagSchema = z.object({
  key: z.string(),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.date(), z.array(z.string())])
    .optional(),
});

const _projectIDSchema = z.string().trim().min(10).max(10);
const _projectFileIDSchema = z.string().uuid();

const _projectFileParams = z.object({
  projectID: _projectIDSchema,
  fileID: _projectFileIDSchema,
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
  authors: z
    .array(
      z
        .object({
          firstName: z.string().trim().min(1).max(100),
          lastName: z.string().trim().min(1).max(100),
          email: z.string().trim().email().optional().or(z.literal("")),
          url: z.string().url().optional().or(z.literal("")),
          primaryInstitution: z.string().trim().optional(),
        })
        .or(z.string().refine((val: string) => isMongoIDValidator(val)))
    )
    .optional(),
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

export const addProjectFileSchema = z.object({
  params: z.object({
    projectID: _projectIDSchema,
  }),
  body: projectFileSchema.merge(
    z.object({
      storageType: z.enum(["file", "folder"]),
      parentID: z.string().uuid().optional(),
      folderName: z.string().trim().max(100).optional(),
    })
  ),
});

export const updateProjectFileSchema = z.object({
  params: _projectFileParams,
  body: projectFileSchema
    .partial()
    .merge(z.object({ tags: z.array(assetTagSchema).optional() })),
});

export const updateProjectFileAccessSchema = z.object({
  params: _projectFileParams,
  body: z.object({
    newAccess: z.enum(["public", "users", "instructors", "team", "mixed"]),
  }),
});

export const moveProjectFileSchema = z.object({
  params: _projectFileParams,
  body: z.object({
    newParent: z.string().uuid(),
  }),
});

export const removeProjectFileSchema = z.object({
  params: _projectFileParams,
});

export const bulkDownloadProjectFilesSchema = z.object({
  params: z.object({
    projectID: _projectIDSchema,
  }),
  query: z.object({
    fileIDs: z.array(z.string().uuid()),
    emailToNotify: z.string().email(),
  }),
});

export const getProjectFileDownloadURLSchema = z.object({
  params: _projectFileParams,
  query: z.object({
    shouldIncrement: z.boolean().optional(),
  }),
});

export const getProjectFileSchema = z.object({
  params: _projectFileParams,
});

export const getProjectFolderContentsSchema = z.object({
  params: z.object({
    projectID: _projectIDSchema,
    folderID: _projectFileIDSchema.optional(),
  }),
});

export const getPublicProjectFilesSchema = z.object({
  query: PaginationSchema,
});
