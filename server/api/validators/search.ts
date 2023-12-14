import { z } from "zod";

export const conductorSearchQuerySchema = z.object({
  searchQuery: z.string().optional(),
  bookLibrary: z.string().optional(),
  bookSubject: z.string().optional(),
  bookLocation: z.enum(["campus", "central"]).optional(),
  bookLicense: z.string().optional(),
  bookAuthor: z.string().optional(),
  bookCourse: z.string().optional(),
  bookPublisher: z.string().optional(),
  bookAffiliation: z.string().optional(),
  bookCID: z.string().optional(),
  assetLicense: z.string().optional(),
  assetLicenseVersion: z.string().optional(),
  assetOrg: z.string().optional(),
  assetFileType: z.string().optional(),
  projLocation: z.enum(["local", "global"]).default("global"),
  projStatus: z.string().default("any"),
  projVisibility: z.enum(['public', 'private']).default("public"),
  projSort: z
    .enum([
      "title",
      "progress",
      "classification",
      "visibility",
      "lead",
      "updated",
    ])
    .default("title"),
  bookSort: z
    .enum(["title", "author", "library", "subject", "affiliation"])
    .default("title"),
  homeworkSort: z.enum(["name", "description"]).default("name"),
  userSort: z.enum(["first", "last"]).default("first"),
  booksPage: z.coerce.number().min(1).default(1),
  booksLimit: z.coerce.number().min(1).default(12),
  assetsPage: z.coerce.number().min(1).default(1),
  assetsLimit: z.coerce.number().min(1).default(12),
  projectsPage: z.coerce.number().min(1).default(1),
  projectsLimit: z.coerce.number().min(1).default(12),
  homeworkPage: z.coerce.number().min(1).default(1),
  homeworkLimit: z.coerce.number().min(1).default(12),
  usersPage: z.coerce.number().min(1).default(1),
  usersLimit: z.coerce.number().min(1).default(12),
  origin: z.enum(["commons", "conductor"]).default("commons"),
});

export const conductorSearchSchema = z.object({
  query: conductorSearchQuerySchema,
});
