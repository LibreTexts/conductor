import base62 from "base62-random";
import { Document, model, Schema } from "mongoose";

export type RestackerTocLicense = {
    label: string;
    raw: string;
    version?: string;
  };

interface RestackerSubPageState {
    "id": string;
    "title": string;
    "url": string;
    "license"?: RestackerTocLicense;
    contentLicense?: RestackerTocLicense[];
    quotation?: number;
    status: "pending" | "completed" | "failed";
}

export interface RestackerInterface extends Document {

    projectID: string;
    restackerID: string;
    createdBy: string;
    updatedBy: string;
    restackerCurrentBook: RestackerSubPageState[];
    message: string[];

}

const RestackerTocLicenseSchema = new Schema<RestackerTocLicense>(
    {
        label: { type: String, required: true },
        raw: { type: String, required: true },
        version: { type: String, required: true },
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
        quotation: { type: Number, required: false },
        status: { type: String, required: true, default: "pending" },
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
    },
);

const Restacker = model<RestackerInterface>("Restacker", RestackerSchema);

export default Restacker;