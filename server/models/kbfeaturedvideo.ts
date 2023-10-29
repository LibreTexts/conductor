import { Document, Schema, model } from "mongoose";

export interface KBFeaturedVideoInterface extends Document {
  uuid: string;
  title: string;
  url: string;
}

const KBFeaturedVideoSchema = new Schema<KBFeaturedVideoInterface>(
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
    url: {
      type: String,
      required: true
    },
  },
  {
    timestamps: true,
  }
);

KBFeaturedVideoSchema.index({ uuid: 1 });

const KBFeaturedVideo = model<KBFeaturedVideoInterface>(
  "KBFeaturedVideo",
  KBFeaturedVideoSchema
);

export default KBFeaturedVideo;
