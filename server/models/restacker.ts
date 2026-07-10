import base62 from "base62-random";
import { Document, model, Schema } from "mongoose";

export type RestackerTocLicense = {
    label: string;
    raw: string;
    version?: string;
  };

export type RestackerStatus = "pending" | "completed" | "failed"; // Keep in sync with RestackerSubPageState.status below

interface RestackerSubPageState {
    "id": string;
    "title": string;
    "url": string;
    "license"?: RestackerTocLicense;
    contentLicense?: RestackerTocLicense[];
    sourceLicense?: RestackerTocLicense;
    quotation?: number;
    status: RestackerStatus;
}

export interface RestackerInterface extends Document {

    projectID: string;
    restackerID: string;
    createdBy: string;
    updatedBy: string;
    restackerCurrentBook: RestackerSubPageState[];
    message: string[];
    processing: boolean;

}

const RestackerTocLicenseSchema = new Schema<RestackerTocLicense>(
    {
        label: { type: String, required: true },
        raw: { type: String, required: true },
        version: { type: String, required: false },
    },
    {
        _id: false,
        strict: false,
    },
);

const RestackerSubPageStateSchema = new Schema<RestackerSubPageState>(
    {
        id: { type: String, required: true },
        title: { type: String, required: true },
        url: { type: String, required: true },
        license: { type: RestackerTocLicenseSchema, required: false },
        contentLicense: { type: [RestackerTocLicenseSchema], required: false },
        sourceLicense: { type: RestackerTocLicenseSchema, required: false },
        quotation: { type: Number, required: false },
        status: { type: String, enum: ["pending", "completed", "failed"], required: true, default: "pending" },
    },
    {
        _id: false,
        strict: false,
    },
);
const RestackerSchema = new Schema<RestackerInterface>(
    {
        projectID: { type: String, required: true },
        restackerID: { type: String, required: true, default: base62(10) },
        createdBy: { type: String, required: true },
        updatedBy: { type: String, required: true },
        restackerCurrentBook: { type: [RestackerSubPageStateSchema], required: true },
        message: { type: [String], required: true, default: [] },
        processing: { type: Boolean, required: true, default: false },
    },
);

const Restacker = model<RestackerInterface>("Restacker", RestackerSchema);

export default Restacker;
