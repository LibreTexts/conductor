import { Document, Schema, model } from "mongoose";

export interface KBPageInterface extends Document {
  uuid: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  slug: string;
  parent?: string;
  imgURLs?: string[];
  lastEditedBy: Schema.Types.ObjectId;
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
    lastEditedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

KBPageSchema.index({ title: "text", description: "text", body: "text" });
KBPageSchema.index({ uuid: 1 }, { unique: true });
KBPageSchema.index({ url: 1 }, { unique: true }); // URL must be unique
KBPageSchema.index({ parent: 1 });

const KBPage = model<KBPageInterface>("KBPage", KBPageSchema);

export default KBPage;
