import { z } from "zod";

const KBUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

// KB Pages
export const GetKBPageValidator = KBUUIDParams;
export const DeleteKBPageValidator = KBUUIDParams;

export const CreateKBPageValidator = z.object({
  body: z.object({
    title: z.string(),
    description: z.string().max(200),
    body: z.string(),
    status: z.enum(["draft", "published"]),
    parent: z.string().uuid().optional(),
    lastEditedBy: z.string().uuid(),
  }),
});

export const UpdateKBPageValidator = KBUUIDParams.merge(CreateKBPageValidator);

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
    title: z.string(),
    url: z.string().url(),
  }),
});

export const DeleteKBFeaturedVideoValidator = KBUUIDParams;
