import { Document, Schema, Types, model } from "mongoose";

export interface AssetTagKeyInterface extends Document<Types.ObjectId> {
  orgID: string;
  title: string;
  hex: string;
  framework?: Schema.Types.ObjectId;
  isDeleted: boolean;
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

const AssetTagKey = model<AssetTagKeyInterface>(
  "AssetTagKey",
  AssetTagKeySchema
);

AssetTagKeySchema.index({
  title: "text",
});

export default AssetTagKey;
