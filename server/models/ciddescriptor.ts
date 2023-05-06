import { model, Schema, Document } from "mongoose";

export interface CIDDescriptorInterface extends Document {
  descriptor: string;
  title: string;
  description?: string;
  approved?: Date;
  expires?: Date;
}

const CIDDescriptorSchema = new Schema<CIDDescriptorInterface>(
  {
    /**
     * The C-ID descriptor.
     */
    descriptor: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * The course title.
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * The course description/overview.
     */
    description: String,
    /**
     * Date the descriptor was approved by the C-ID program.
     */
    approved: Date,
    /**
     * Date after which the descriptor is no longer valid in the program.
     */
    expires: Date,
  },
  {
    timestamps: true,
  }
);

CIDDescriptorSchema.index({
  title: "text",
  description: "text",
});

const CIDDescriptor = model<CIDDescriptorInterface>(
  "CIDDescriptor",
  CIDDescriptorSchema
);

export default CIDDescriptor;
