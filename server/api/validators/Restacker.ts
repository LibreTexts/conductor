import { z } from "zod";


export const GetRestackerPageSchema = z.object({
  params: z.object({
    projectID: z.string().length(10),
  }),
});