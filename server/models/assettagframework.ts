import mongoose, { model, Schema, Document } from "mongoose";
import AssetTag, { AssetTagInterface } from "./assettag";

export interface AssetTagFrameworkInterface extends Document {
  name: string;
  description: string;
  orgID: string;
  tags: AssetTagInterface[] | mongoose.Types.ObjectId[];
  enabled: boolean;
}
const AssetTagFrameworkSchema = new Schema<AssetTagFrameworkInterface>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    orgID: {
      type: String,
      required: true,
    },
    tags: {
      type: [Schema.Types.ObjectId],
      required: true,
      ref: AssetTag,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const AssetTagFramework = model<AssetTagFrameworkInterface>(
  "AssetTagFramework",
  AssetTagFrameworkSchema
);

export default AssetTagFramework;