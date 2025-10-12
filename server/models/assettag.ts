import { Document, Schema, Types, model } from "mongoose";
import { AssetTagKeyInterface } from "./assettagkey";

export interface AssetTagInterface extends Document<Types.ObjectId> {
  uuid: string;
  key: Types.ObjectId | AssetTagKeyInterface | string;
  value?: string | number | boolean | Date | string[];
  framework?: Types.ObjectId;
}

const AssetTagSchema = new Schema<AssetTagInterface>({
  uuid: {
    type: String,
    required: true,
  },
  key: {
    type: Schema.Types.ObjectId,
    ref: "AssetTagKey",
    required: true,
  },
  value: {
    type: Schema.Types.Mixed,
  },
  framework: {
    type: Schema.Types.ObjectId,
    ref: "AssetTagFramework",
    required: false,
  }
});

const AssetTag = model<AssetTagInterface>("AssetTag", AssetTagSchema);

// Unique index
AssetTagSchema.index({ uuid: 1 }, { unique: true });

// Text search index
AssetTagSchema.index({
  value: "text",
});

export default AssetTag;
