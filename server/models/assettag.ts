import { Document, Schema, model } from "mongoose";

export interface AssetTagInterface extends Document {
  uuid: string;
  title: string;
  value: string | number | boolean | Date | string[];
  framework?: string;
  isDeleted: boolean;
}

const AssetTagSchema = new Schema<AssetTagInterface>({
  uuid: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
  framework: {
    type: Schema.Types.ObjectId,
    ref: "AssetTagFramework",
    required: false,
  },
  isDeleted: {
    type: Boolean,
    required: true,
    default: false,
  },
});

const AssetTag = model<AssetTagInterface>("AssetTag", AssetTagSchema);

// Unique index
AssetTagSchema.index({ uuid: 1 }, { unique: true });

// Text search index
AssetTagSchema.index({
  title: "text",
  value: "text",
});

export default AssetTag;
