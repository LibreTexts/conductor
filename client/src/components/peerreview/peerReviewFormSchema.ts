import { z } from "zod";

export const peerReviewSchema = z.object({
  authorType: z.string(),
  rating: z.number().min(0).max(5),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  prompts: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

export type PeerReviewFormValues = z.infer<typeof peerReviewSchema>;
