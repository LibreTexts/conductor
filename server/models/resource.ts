/**
 * Nested model used inside Collections
 */
import { model, Document, Schema } from "mongoose";
export interface ResourceInterface extends Document {
  resourceType: "resource" | "collection";
  resourceID: string;
}
export const ResourceSchema = new Schema<ResourceInterface>({
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

const Resource = model<ResourceInterface>("Resource", ResourceSchema);

export default Resource;
