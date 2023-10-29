import { Document, Schema, model } from "mongoose";

export interface KBFeaturedPageInterface extends Document {
  uuid: string;
  page: string; // KBPage uuid
}

const KBFeaturedPageSchema = new Schema<KBFeaturedPageInterface>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
    },
    page: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

KBFeaturedPageSchema.index({ uuid: 1 });

const KBFeaturedPage = model<KBFeaturedPageInterface>(
  "KBFeaturedPage",
  KBFeaturedPageSchema
);

export default KBFeaturedPage;
