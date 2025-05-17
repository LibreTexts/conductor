import { z } from "zod";
import { PaginationSchema } from "./misc.js";

export const GetUsersSchema = z.object({
  query: z
    .object({
      query: z.string().min(1).max(50).or(z.literal("")).optional(),
      sort: z.enum(["first", "last", "email"]).optional().default("first"),
    })
    .merge(PaginationSchema),
});

export const UpdateUserPinnedProjectsSchema = z.object({
  body: z
    .object({
      action: z.enum([
        "add-project",
        "remove-project",
        "add-folder",
        "remove-folder",
        "move-project",
      ]),
      folder: z.string().min(1).max(50).trim().optional(),
      projectID: z.string().min(1).max(50).optional(),
    })
    .refine((data) => {
      // Check if projectID is required for certain actions
      if (
        (["add-project", "remove-project", "move-project"].includes(data.action)) &&
        !data.projectID
      ) {
        return false;
      }

      // Check if folder is required for certain actions
      if (["add-project","add-folder", "move-project"].includes(data.action)) {
        if (!data.folder) {
          return false;
        }
      }

      return true;
    }, "projectID or folder is required for this action"),
});
