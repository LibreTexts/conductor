import { z } from "zod";

export const autocompleteSchema = z.object({
  query: z.object({
    query: z
      .string()
      .min(1)
      .max(100)
      .transform((v) =>
        v.trim().length > 100 ? v.trim().slice(0, 100) : v.trim()
      ), // If the query is longer than 50 characters, trim it to 100 characters
    limit: z.coerce.number().min(1).max(25).default(10),
  }),
});

const _commonItems = z.object({
  strictMode: z.coerce.boolean().default(false),
  searchQuery: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).default(12),
});

export const assetSearchSchema = z.object({
  query: z
    .object({
      license: z.string().optional(),
      licenseVersion: z.string().optional(),
      org: z.string().optional(),
      fileType: z.string().optional(),
    })
    .merge(_commonItems),
});

export const bookSearchSchema = z.object({
  query: z
    .object({
      library: z.string().optional(),
      subject: z.string().optional(),
      location: z.enum(["campus", "central"]).optional(),
      license: z.string().optional(),
      author: z.string().optional(),
      course: z.string().optional(),
      publisher: z.string().optional(),
      affiliation: z.string().optional(),
      CID: z.string().optional(),
      sort: z
        .enum(["title", "author", "library", "subject", "affiliation"])
        .default("title"),
    })
    .merge(_commonItems),
});

export const homeworkSearchSchema = z.object({
  query: z
    .object({
      sort: z.enum(["name", "description"]).default("name"),
    })
    .merge(_commonItems),
});

export const projectSearchSchema = z.object({
  query: z
    .object({
      location: z.enum(["local", "global"]).default("global"),
      status: z.string().default("any"),
      visibility: z.enum(["public", "private"]).default("public"),
      sort: z
        .enum([
          "title",
          "progress",
          "classification",
          "visibility",
          "lead",
          "updated",
        ])
        .default("title"),
    })
    .merge(_commonItems),
});

export const userSearchSchema = z.object({
  query: z
    .object({
      sort: z.enum(["first", "last"]).default("first"),
    })
    .merge(_commonItems),
});
