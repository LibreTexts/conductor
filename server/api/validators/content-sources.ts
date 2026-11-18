import { z } from "zod";
import { PAGE_NODE_KINDS } from "../../models/pagenode.js";

const ProjectParams = z.object({
  projectID: z.string().length(10),
});

/** `GET /project/:projectID/content-sources`: the book's provenance overview. */
export const GetContentSourcesSchema = z.object({
  params: ProjectParams,
});

/** `GET /project/:projectID/content-sources/pages`: the whole book's pages, in order, with their sources. */
export const GetContentPagesSchema = z.object({
  params: ProjectParams,
  query: z.object({
    kind: z.enum(PAGE_NODE_KINDS).optional(),
    /** Only pages whose source changed or broke. */
    attention: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
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

/** `POST /project/:projectID/content-sources/changes/:eventID/review`: mark a source change reviewed. */
export const ReviewSourceChangeSchema = z.object({
  params: ProjectParams.extend({
    eventID: z.string().regex(/^[a-f0-9]{24}$/i, "Expected a change ID."),
  }),
});

/** `GET /project/:projectID/content-sources/changes/:eventID/revisions`: a change's revisions and diff. */
export const GetSourceChangeRevisionsSchema = ReviewSourceChangeSchema;

/** `GET …/changes/:eventID/revisions/:revision`: one of the change's own revisions of its source page. */
export const GetSourceRevisionSchema = z.object({
  params: ReviewSourceChangeSchema.shape.params.extend({
    revision: z.coerce.number().int().min(1).max(10_000_000),
  }),
});

export type GetContentSourcesRequest = z.infer<typeof GetContentSourcesSchema>;
export type GetContentPagesRequest = z.infer<typeof GetContentPagesSchema>;
export type GetContentPageLineageRequest = z.infer<typeof GetContentPageLineageSchema>;
export type ReviewSourceChangeRequest = z.infer<typeof ReviewSourceChangeSchema>;
export type GetSourceRevisionRequest = z.infer<typeof GetSourceRevisionSchema>;
