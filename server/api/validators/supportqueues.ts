import { z } from "zod";

const SlugOnlyParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Invalid queue slug"),
  }),
});

export const getSupportQueuesSchema = z.object({
  query: z.object({
    with_count: z.coerce.boolean().optional(),
  }).optional(),
});

export const getSupportQueueSchema = z.object({
  query: z.object({
    with_count: z.coerce.boolean().optional(),
  }).optional(),
}).merge(SlugOnlyParamSchema);

export const getMetricsSchema = SlugOnlyParamSchema;

export const updateAutoAssignConfigSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Invalid queue id"),
  }),
  body: z.object({
    auto_assign_enabled: z.boolean(),
    auto_assign_uuids: z.array(z.string()),
  }),
});