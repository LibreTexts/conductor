import { z } from "zod";

export const getCampusDefaultFrameworkValidator = z.object({
    params: z.object({
        orgID: z.string(),
    })
})