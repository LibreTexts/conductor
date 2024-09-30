import { Document, Schema, model } from "mongoose";
import { SanitizedUserSelectProjection } from "./user.js";

export interface KBPageInterface extends Document {
  uuid: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  slug: string;
  parent?: string;
  imgURLs?: string[];
  lastEditedByUUID: string; // User uuid
}

const KBPageSchema = new Schema<KBPageInterface>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    body: {
      type: String,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    slug: {
      type: String,
      required: true,
    },
    parent: {
      type: String,
    },
    imgURLs: {
      type: [String],
    },
    lastEditedByUUID: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

KBPageSchema.virtual("lastEditedBy", {
  ref: "User",
  localField: "lastEditedByUUID",
  foreignField: "uuid",
  justOne: true,
  options: {
    projection: SanitizedUserSelectProjection
  },
})

KBPageSchema.index({ title: "text", description: "text", body: "text" });
KBPageSchema.index({ slug: 1 }, { unique: true }); // slug must be unique
KBPageSchema.index({ parent: 1 });

const KBPage = model<KBPageInterface>("KBPage", KBPageSchema);

export default KBPage;
