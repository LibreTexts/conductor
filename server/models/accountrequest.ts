import { model, Model, Schema, Document } from "mongoose";

export enum AccountRequestStatus {
  OPEN = "open",
  COMPLETED = "completed",
}

export enum AccountRequestPurpose {
  OER = "oer",
  H5P = "h5p",
  ADAPT = "adapt",
  ANALYTICS = "analytics",
}
export interface AccountRequestInterface extends Document {
  status: AccountRequestStatus;
  requester: string;
  purpose: AccountRequestPurpose;
  libraries: string[];
  moreInfo: boolean;
}

const AccountRequestSchema: Schema<AccountRequestInterface> = new Schema(
  {
    /**
     * Current status of the request.
     */
    status: {
      type: String,
      enum: AccountRequestStatus,
    },
    /**
     * UUID of the requester.
     */
    requester: {
      type: String,
      required: true,
    },
    /**
     * The LibreTexts service the requester would like access to.
     */
    purpose: {
      type: String,
      required: true,
      enum: AccountRequestPurpose,
    },
    /**
     * List of LibreTexts libraries the requester would like access to if `purpose` is `oer`.
     */
    libraries: [String],
    /**
     * Indicates the requester would like more information about the LibreNet.
     */
    moreInfo: Boolean,
  },
  {
    timestamps: true,
  }
);

const AccountRequest: Model<AccountRequestInterface> = model(
  "AccountRequest",
  AccountRequestSchema
);
export default AccountRequest;
