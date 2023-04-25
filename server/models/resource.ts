/**
 * Nested model used inside Collections
 */
import { model, Model, Document, Schema } from "mongoose";
export interface ResourceInterface extends Document {
  resourceType: "resource" | "collection";
  resourceID: string;
}
export const ResourceSchema: Schema<ResourceInterface> = new Schema({
  resourceType: {
    type: String,
    default: "resource",
    enum: ["resource", "collection"],
  },
  resourceID: {
    type: String,
    required: true,
  },
});

const Resource: Model<ResourceInterface> = model("Resource", ResourceSchema);

export default Resource;
