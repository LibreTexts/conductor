import { model, Model, Schema, Document } from "mongoose";

export interface AnalyticsInviteInterface extends Document {
  courseID: string;
  accepted?: boolean;
  acceptedAt?: Date;
  expiresAt: Date;
  sender: string;
  invitee: string;
  newRole: "instructor" | "viewer";
}

const AnalyticsInviteSchema: Schema<AnalyticsInviteInterface> = new Schema(
  {
    /**
     * Identifier of the course being shared.
     */
    courseID: {
      type: String,
      required: true,
    },
    /**
     * Indicates the invitation has been accepted (and was not expired).
     */
    accepted: Boolean,
    /**
     * Date when the invitation was accepted.
     */
    acceptedAt: Date,
    /**
     * The Date after which the invitation is no longer valid, if not accepted.
     */
    expiresAt: {
      type: Date,
      required: true,
    },
    /**
     * UUID of the user who created the invitation.
     */
    sender: {
      type: String,
      required: true,
    },
    /**
     * UUID of the invitee.
     */
    invitee: {
      type: String,
      required: true,
    },
    /**
     * Role to assign the invitee in the course if the invitation is accepted.
     */
    newRole: {
      type: String,
      required: true,
      enum: ["instructor", "viewer"],
    },
  },
  {
    timestamps: true,
  }
);

const AnalyticsInvite: Model<AnalyticsInviteInterface> = model(
  "AnalyticsInvite",
  AnalyticsInviteSchema
);

export default AnalyticsInvite;
