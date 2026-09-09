import { z } from "zod";

export const glossaryConfigModeEnum = z.enum(["PAGE", "CHAPTER", "BACKEND"]);

const glossaryConfigGroupSchema = z.object({
  groupID: z.string().min(1).max(64),
  pageIds: z.array(z.string().min(1).max(100)).max(2000),
  targetPageId: z.string().min(1).max(100),
});

export const getGlossaryConfigSchema = z.object({
  params: z.object({
    coverID: z.coerce.number().int().positive().max(999999999999),
    library: z.string().min(2).max(12),
  }),
});

export const saveGlossaryConfigSchema = z.object({
  params: getGlossaryConfigSchema.shape.params,
  body: z.object({
    mode: glossaryConfigModeEnum,
    glossaryPageId: z.string().max(100).optional(),
    groups: z.array(glossaryConfigGroupSchema).max(500),
  }),
});

export const deleteGlossaryConfigSchema = getGlossaryConfigSchema;
