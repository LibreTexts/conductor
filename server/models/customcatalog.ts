import { model, Schema, Document } from "mongoose";

export interface CustomCatalogInterface extends Document {
  orgID: string;
  resources: string[];
  automaticMatchingExclusions: string[];
}

const CustomCatalogSchema = new Schema<CustomCatalogInterface>(
  {
    orgID: {
      // the organization's internal identifier string (one custom catalog/organization)
      type: String,
      required: true,
      unique: true,
    },
    resources: [String], // the array of resource IDs included in the custom catalog
    automaticMatchingExclusions: [String], // the array of resource IDs excluded from automatic matching (if enabled)
  },
  {
    timestamps: true,
  }
);

const CustomCatalog = model<CustomCatalogInterface>(
  "CustomCatalog",
  CustomCatalogSchema
);

export default CustomCatalog;
