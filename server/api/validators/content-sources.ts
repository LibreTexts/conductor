import { z } from "zod";
import { PAGE_NODE_KINDS } from "../../models/pagenode.js";

const ProjectParams = z.object({
  projectID: z.string().length(10),
});

/** `GET /project/:projectID/content-sources`: the book's provenance overview. */
export const GetContentSourcesSchema = z.object({
  params: ProjectParams,
});

/** `GET /project/:projectID/content-sources/pages`: the book's pages and their sources. */
export const GetContentPagesSchema = z.object({
  params: ProjectParams,
  query: z.object({
    kind: z.enum(PAGE_NODE_KINDS).optional(),
    /** Only pages whose source changed or broke. */
    attention: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

/** `GET /project/:projectID/content-sources/pages/:pageID/lineage`: one page's chain. */
export const GetContentPageLineageSchema = z.object({
  params: ProjectParams.extend({
    pageID: z.coerce.number().int().positive(),
  }),
  query: z.object({
    direction: z.enum(["up", "down"]).default("up"),
  }),
});

/** `PUT /project/:projectID/content-sources/notifications`: turn source-change emails on or off. */
export const UpdateContentSourcesNotificationsSchema = z.object({
  params: ProjectParams,
  body: z.object({
    enabled: z.boolean(),
  }),
});

export type GetContentSourcesRequest = z.infer<typeof GetContentSourcesSchema>;
export type GetContentPagesRequest = z.infer<typeof GetContentPagesSchema>;
export type GetContentPageLineageRequest = z.infer<typeof GetContentPageLineageSchema>;
export type UpdateContentSourcesNotificationsRequest = z.infer<
  typeof UpdateContentSourcesNotificationsSchema
>;
