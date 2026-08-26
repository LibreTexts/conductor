import { z } from "zod";

export const GetRemixerPageSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    path: z.string().min(1),
    subdomain: z.string().min(1),
    pageDetails: z.boolean().default(false),
    currentbook: z.boolean().default(true),
    option: z
      .object({
        includeMatter: z.boolean().default(false),
        linkTitle: z.boolean().default(false),
        full: z.boolean().default(false),
      })
      .optional(),
  }),
  query: z.object({}).optional(),
});

export const GetRemixerPageTreeSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    path: z.coerce.number().int().min(1),
    subdomain: z.string().min(1),
    options: z.object({
      flatten: z.boolean().default(true),
      preserveConfigs: z.boolean().default(true),
    }).optional(),
  }),
});

export const SaveRemixerProjectStateSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    currentBook: z.array(z.record(z.string(), z.any())),
    pathLevelFormats: z.array(
      z
        .object({
          level: z.number(),
          prefix: z.string().default(""),
          start: z.number().default(1),
          type: z.enum([
            "numeric",
            "alphabetic",
            "alphabetic_lower",
            "roman",
            "roman_lower",
            "none",
          ]),
          delimiter: z.string().optional(),
          excludeParent: z.boolean().optional(),
          continue: z.boolean().optional(),
        })
        .passthrough(),
    ),
    autoNumbering: z.boolean().optional(),
    copyModeState: z.string().optional(),
  }),
  query: z.object({}).optional(),
});

export const GetRemixerProjectStateSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});


export const CreateMatterSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    type: z.enum(["front", "back", "both"]),
    overwrite: z.boolean().default(false),
  })
});