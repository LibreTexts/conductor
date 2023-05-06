import { model, Schema, Document } from "mongoose";

export interface HarvestingRequestInterface extends Document {
  email: string;
  title: string;
  status: "open" | "converted" | "declined";
  library: string;
  url?: string;
  license: string;
  name?: string;
  institution?: string;
  resourceUse?: string;
  dateIntegrate?: Date;
  comments?: string;
  submitter?: string;
  addToProject?: boolean;
  declineReason?: string;
}

const HarvestingRequestSchema = new Schema<HarvestingRequestInterface>(
  {
    email: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "open", // request status, one of: ['open', 'converted', 'declined']
    },
    library: {
      type: String,
      required: true,
    },
    url: String,
    license: {
      type: String,
      required: true,
    },
    name: String,
    institution: String,
    resourceUse: String,
    dateIntegrate: Date,
    comments: String,
    submitter: String, // user's uuid if submitter was authenticated,
    addToProject: Boolean, // if user was authenticated, choice to be added to project team upon conversion
    declineReason: String, // reason if request was declined by admin
  },
  {
    timestamps: true,
  }
);

const HarvestingRequest = model<HarvestingRequestInterface>(
  "HarvestingRequest",
  HarvestingRequestSchema
);

export default HarvestingRequest;
