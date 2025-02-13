import { z } from "zod";
import { PaginationSchema } from "./misc.js";
import { ProjectRole } from "../../util/projectinvitations";

const _projectIDSchema = z.string()
// const _projectIDSchema = z.string().trim().min(10).max(10);
const _projectInviteIDSchema = z.string().uuid();
const _projectTokenSchema = z.string().uuid();


export const createProjectInvitationSchema = z.object({
    params: z.object({
        projectID: _projectIDSchema
    }),
    body: z.object({
        email: z.string().email(),
        role: z.nativeEnum(ProjectRole)
    })
});

export const getProjectInvitationSchema = z.object({
    params: z.object({
        inviteID: _projectInviteIDSchema
    }),
    query: z.object({
        token: _projectTokenSchema
    })
});

export const getAllProjectInvitationsSchema = z.object({
    params: z.object({
      projectID: _projectIDSchema, 
    }),
    query: PaginationSchema, 
});

export const deleteProjectInvitationSchema = z.object({
    params: z.object({
        inviteID: _projectInviteIDSchema
    }),
    // query: z.object({
    //     token: _projectTokenSchema
    // })
});

export const updateProjectInvitationSchema = z.object({
    params: z.object({
        inviteID: _projectInviteIDSchema
    }),
    body: z.object({
        role: z.nativeEnum(ProjectRole)
    })
});

export const acceptProjectInvitationSchema = z.object({
    params: z.object({
        inviteID: _projectInviteIDSchema
    }),
    query: z.object({
        token: _projectTokenSchema
    })
});
