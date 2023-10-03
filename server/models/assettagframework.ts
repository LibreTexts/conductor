import mongoose, { model, Schema, Document } from "mongoose";
import AssetTag, { AssetTagInterface } from "./assettag.js";

export interface AssetTagFrameworkInterface extends Document {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  tags: AssetTagInterface[] | mongoose.Types.ObjectId[];
  enabled: boolean;
}
const AssetTagFrameworkSchema = new Schema<AssetTagFrameworkInterface>(
  {
    uuid: {
      type: String,
      required: true,
    },
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
      type: [AssetTag.schema],
      required: true,
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

AssetTagFrameworkSchema.index({
  name: "text",
});

const AssetTagFramework = model<AssetTagFrameworkInterface>(
  "AssetTagFramework",
  AssetTagFrameworkSchema
);

export default AssetTagFramework;
