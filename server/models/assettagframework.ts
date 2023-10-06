import { model, Schema, Document } from "mongoose";
import AssetTagTemplateSchema, {
  AssetTagTemplateInterface,
} from "./assettagtemplate.js";

export interface AssetTagFrameworkInterface extends Document {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  templates: AssetTagTemplateInterface[];
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
    templates: {
      type: [AssetTagTemplateSchema],
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
