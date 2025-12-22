import { z } from "zod";

const KBUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

// KB Pages
export const GetKBPageValidator = z
  .object({
    params: z.object({
      uuid: z.string().uuid().optional(),
      slug: z.string().optional(),
    }),
  })
  .refine((data) => {
    if (!data.params.uuid && !data.params.slug) {
      throw new Error("Either uuid or slug must be provided");
    }
    return true;
  });

export const DeleteKBPageValidator = KBUUIDParams;

export const CreateKBPageValidator = z.object({
  body: z
    .object({
      title: z.string().max(100),
      description: z.string().max(200),
      body: z.string(),
      status: z.enum(["draft", "published"]),
      slug: z.string().optional(),
      parent: z.string().uuid().optional(),
    })
    .refine((data) => {
      if (
        data.slug &&
        ["new", "edit", "create", "welcome"].includes(data.slug)
      ) {
        throw new Error(
          "Slug cannot be reserved word ('new', 'edit', 'create', 'welcome')"
        );
      }
      return true;
    }),
});

export const AddKbImageValidator = KBUUIDParams;

export const UpdateKBPageValidator = KBUUIDParams.merge(CreateKBPageValidator);

export const SearchKBValidator = z.object({
  query: z.object({
    query: z.string().min(3),
  }),
});

// KB Tree
export const GetKBTreeValidator = z.object({
  params: z.object({
    uuid: z.string().uuid().optional(), // Optional here, if not provided, return root
  }),
});

// KB Featured Pages
export const CreateKBFeaturedPageValidator = z.object({
  body: z.object({
    page: z.string().uuid(),
  }),
});

export const DeleteKBFeaturedPageValidator = KBUUIDParams;

// KB Featured Videos
export const CreateKBFeaturedVideoValidator = z.object({
  body: z.object({
    title: z.string().max(100),
    url: z.string().url(),
  }),
});

export const DeleteKBFeaturedVideoValidator = KBUUIDParams;

// Misc
export const GetOEmbedValidator = z.object({
  query: z.object({
    url: z.string().url(),
  }),
});

// Qdrant Migration
export const MigrateToQdrantValidator = z.object({
  query: z.object({
    start: z.coerce.number().int().min(0).optional().default(0),
    stop: z.union([
      z.literal("all"),
      z.coerce.number().int().min(0),
    ]).optional(),
  }),
});

// Agent Session
export const CreateAgentSessionValidator = z.object({
  body: z.object({
    userId: z.string().uuid().optional(),
  }).optional(),
});

// Agent Query
export const AgentQueryLangGraphValidator = z.object({
  body: z.object({
    query: z.string().min(1, "Query is required and must be a non-empty string"),
    sessionId: z.string().min(1, "SessionId is required and must be a non-empty string"),
  }),
});
