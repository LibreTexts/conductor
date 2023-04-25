import { model, Model, Schema, Document } from "mongoose";

export interface CustomCatalogInterface extends Document {
  orgID: string;
  resources: string[];
}

const CustomCatalogSchema: Schema<CustomCatalogInterface> = new Schema(
  {
    orgID: {
      // the organization's internal identifier string (one custom catalog/organization)
      type: String,
      required: true,
      unique: true,
    },
    resources: [String], // the array of resource IDs included in the custom catalog
  },
  {
    timestamps: true,
  }
);

const CustomCatalog: Model<CustomCatalogInterface> = model(
  "CustomCatalog",
  CustomCatalogSchema
);

export default CustomCatalog;
