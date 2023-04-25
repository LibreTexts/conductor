import { model, Model, Schema, Document } from "mongoose";

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

const AnalyticsRequestSchema: Schema<AnalyticsRequestInterface> = new Schema(
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

const AnalyticsRequest: Model<AnalyticsRequestInterface> = model(
  "AnalyticsRequest",
  AnalyticsRequestSchema
);

export default AnalyticsRequest;
