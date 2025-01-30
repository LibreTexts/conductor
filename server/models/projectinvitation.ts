import { model, Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { SanitizedUserSelectProjection } from "./user.js";

export interface ProjectInvitationInterface extends Document {
    inviteID: string;
    projectID: string;
    senderID: string;
    email: string;
    token: string;
    role: string;
    accepted: boolean;
    expires: Date;
}

const ProjectInvitationSchema: Schema<ProjectInvitationInterface> = new Schema(
    {
        inviteID: {
            type: String,
            default: uuidv4,
            unique: true,
            required: true,
            index: true
        },
        projectID: {
            type: String,
            required: true,
        },
        senderID: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        token: {
            type: String,
            default: uuidv4,
            unique: true,
            required: true,
            index: true
        },
        role: {
            type: String,
            required: true,
        },
        accepted: {
            type: Boolean,
            default: false,
        },
        expires: {
            type: Date,
            default: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
    },
    {
        timestamps: true,
    }
);

ProjectInvitationSchema.virtual("sender", {
    ref: "User",
    localField: "senderID",
    foreignField: "uuid",
    justOne: true,
    options: {
      projection: SanitizedUserSelectProjection,
    },
  });
  
  ProjectInvitationSchema.virtual("project", {
    ref: "Project",
    localField: "projectID",
    foreignField: "projectID",
    justOne: true,
  });
  
  const ProjectInvitation = model<ProjectInvitationInterface>(
    "ProjectInvitation",
    ProjectInvitationSchema
  );
  
  export default ProjectInvitation;
  
