import { Document, Schema, model } from "mongoose";

export interface AssetTagKeyInterface extends Document {
  orgID: string;
  title: string;
  hex: string;
}

const AssetTagKeySchema = new Schema<AssetTagKeyInterface>({
  orgID: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  hex: {
    type: String,
    required: true,
  },
});

const AssetTagKey = model<AssetTagKeyInterface>(
  "AssetTagKey",
  AssetTagKeySchema
);

AssetTagKeySchema.index({
    title: "text",
});

export default AssetTagKey;
