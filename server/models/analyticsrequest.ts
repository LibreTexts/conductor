import { model, Schema, Document } from "mongoose";

export enum AnalyticsRequestStatus {
  OPEN = "open",
  APPROVED = "approved",
  DENIED = "denied",
}

export interface AnalyticsRequestInterface extends Document {
  status: AnalyticsRequestStatus;
  requester?: string;
  courseID: string;
}

const AnalyticsRequestSchema = new Schema<AnalyticsRequestInterface>(
  {
    /**
     * Current status of the request.
     */
    status: {
      type: String,
      enum: AnalyticsRequestStatus,
    },
    /**
     * UUID of the requester.
     */
    requester: {
      type: String,
      required: true,
    },
    /**
     * Identifier of the Analytics Course being requested.
     */
    courseID: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AnalyticsRequest = model<AnalyticsRequestInterface>(
  "AnalyticsRequest",
  AnalyticsRequestSchema
);

export default AnalyticsRequest;
