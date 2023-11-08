import { Schema } from "mongoose";

export type AssetTagTemplateValueType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown"
  | "multiselect";

export const AssetTagTemplateValueTypeOptions: string[] = [
  "text",
  "number",
  "date",
  "boolean",
  "dropdown",
  "multiselect",
]

export interface AssetTagTemplateInterface {
  key: Schema.Types.ObjectId;
  valueType: AssetTagTemplateValueType;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  isDeleted: boolean;
}

const AssetTagTemplateSchema = new Schema<AssetTagTemplateInterface>({
  key: {
    type: Schema.Types.ObjectId,
    ref: "AssetTagKey",
    required: true,
  },
  valueType: {
    type: String,
    required: true,
  },
  defaultValue: {
    type: Schema.Types.Mixed,
    required: false,
  },
  options: {
    type: [String],
    required: false,
  },
  isDeleted: {
    type: Boolean,
    required: true,
    default: false,
  },
});

// We don't define a model for this schema because it's only used as a subdocument

export default AssetTagTemplateSchema;
