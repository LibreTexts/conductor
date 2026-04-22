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

export const SaveRemixerProjectStateSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    currentBook: z.array(z.record(z.string(), z.any())),
    pathLevelFormats: z.array(z.record(z.string(), z.any())),
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
