import { z } from "zod";
import { PaginationSchema } from "./misc.js";

export const GetUsersSchema = z.object({
    query: z.object({
        query: z.string().min(1).max(50).or(z.literal("")).optional(),
        sort: z.enum(['first', 'last', 'email']).optional().default('first'),
    }).merge(PaginationSchema)
})

export const GetUserNotesSchema = z.object({
    params: z.object({
      userId: z.string().uuid()
    })
});
  
export const CreateUserNoteSchema = z.object({
    params: z.object({
      userId: z.string().uuid()
    }),
    body: z.object({
      content: z.string().min(1)
    })
});
  
export const UpdateUserNoteSchema = z.object({
    params: z.object({
      userId: z.string().uuid(),
      noteId: z.string().uuid()
    }),
    body: z.object({
      content: z.string().min(1)
    })
});

export const DeleteUserNoteSchema = z.object({
    params: z.object({
      userId: z.string().uuid(),
      noteId: z.string().uuid()
    })
});