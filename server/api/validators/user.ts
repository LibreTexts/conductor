import { z } from "zod";
import { PaginationSchema } from "./misc.js";

export const GetUsersSchema = z.object({
    query: z.object({
        query: z.string().min(1).max(50).or(z.literal("")).optional(),
        sort: z.enum(['first', 'last', 'email']).optional().default('first'),
    }).merge(PaginationSchema)
})