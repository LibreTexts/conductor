import { z } from "zod";
import { PaginationSchema, isMongoIDValidator } from "./misc.js";
import { zfd } from "zod-form-data";
import { param } from "express-validator";

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

export const videoDataSchema = z.object({
  videoID: z.string(),
  videoName: z.string(),
});

const projectFileAuthorSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().optional().or(z.literal("")),
  url: z.string().url().optional().or(z.literal("")),
  primaryInstitution: z.string().trim().optional(),
});

export const projectFileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  tags: z.array(assetTagSchema).optional(),
  license: z
    .object({
      name: z.string().trim().max(255).optional().or(z.literal("")),
      url: z.string().trim().url().optional().or(z.literal("")),
      version: z.string().trim().max(255).optional().or(z.literal("")),
      sourceURL: z.string().url().optional(),
      modifiedFromSource: z.coerce.boolean().optional(),
      additionalTerms: z.string().trim().max(500).optional(),
    })
    .optional(),
  primaryAuthor: projectFileAuthorSchema
    .or(z.string().refine((val: string) => isMongoIDValidator(val)))
    .optional(),
  authors: z
    .array(
      projectFileAuthorSchema.or(
        z.string().refine((val: string) => isMongoIDValidator(val))
      )
    )
    .optional(),
  correspondingAuthor: projectFileAuthorSchema
    .or(z.string().refine((val: string) => isMongoIDValidator(val)))
    .optional(),
  publisher: z
    .object({
      name: z.string().trim().max(255).optional().or(z.literal("")),
      url: z.string().url().optional().or(z.literal("")),
    })
    .optional(),
  isURL: z.coerce.boolean().optional(),
  fileURL: z.string().url().optional(),
  parentID: z.string().uuid().optional().or(z.literal("")),
  videoData: z.array(videoDataSchema).max(20).optional(),
});

export const addProjectFileSchema = z.object({
  params: z.object({
    projectID: _projectIDSchema,
  }),
  body: zfd.formData(projectFileSchema),
});

export const addProjectFileFolderSchema = z.object({
  params: z.object({
    projectID: _projectIDSchema,
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100),
    parentID: z.string().uuid().optional().or(z.literal("")),
  }),
});

export const updateProjectFileSchema = z.object({
  params: _projectFileParams,
  body: zfd.formData(
    projectFileSchema.partial().merge(
      z.object({
        tags: z.array(assetTagSchema).optional(),
        overwriteName: z.coerce.boolean().optional(),
      })
    )
  ),
});

export const updateProjectFileAccessSchema = z.object({
  params: _projectFileParams,
  body: z.object({
    newAccess: z.enum(["public", "users", "instructors", "team", "mixed"]),
  }),
});

export const updateProjectFileCaptionsSchema = z.object({
  params: _projectFileParams,
  body: zfd.formData(
    z.object({
      language: z.string().length(2), // IANA language code
    })
  ),
});

export const moveProjectFileSchema = z.object({
  params: _projectFileParams,
  body: z.object({
    newParent: z.string().uuid().or(z.literal("")),
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
    shouldIncrement: z.coerce.boolean().optional(),
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

export const getProjectFileCaptionsSchema = z.object({
  params: _projectFileParams,
});

export const getPublicProjectFilesSchema = z.object({
  query: PaginationSchema,
});

export const createCloudflareStreamURLSchema = z.object({
  //params: _projectFileParams,
  body: z.object({
    contentLength: z.coerce.number(),
  }),
});
