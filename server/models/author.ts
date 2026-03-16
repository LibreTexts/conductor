import { Schema, model, Document } from "mongoose";

export interface AuthorInterface extends Document {
  orgID: string;
  nameKey: string; // A normalized version of the name for indexing and searching. Must be unique within an orgID.
  name: string;
  nameTitle?: string;
  nameURL?: string;
  note?: string;
  noteURL?: string;
  companyName?: string;
  companyURL?: string;
  pictureCircle?: string; // i.e. "yes" or "no"
  pictureURL?: string;
  programName?: string;
  programURL?: string;
  attributionPrefix?: string;
  userUUID?: string; // Optional field if the user uuid of the matching author is known
}

const AuthorSchema = new Schema<AuthorInterface>({
  orgID: {
    type: String,
    required: true,
  },
  nameKey: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  nameTitle: {
    type: String,
    required: false,
  },
  nameURL: {
    type: String,
    required: false,
  },
  note: {
    type: String,
    required: false,
  },
  noteURL: {
    type: String,
    required: false,
  },
  companyName: {
    type: String,
    required: false,
  },
  companyURL: {
    type: String,
    required: false,
  },
  pictureCircle: {
    type: String,
  },
  pictureURL: {
    type: String,
    required: false,
  },
  programName: {
    type: String,
    required: false,
  },
  programURL: {
    type: String,
    required: false,
  },
  attributionPrefix: {
    type: String,
    required: false,
  },
  userUUID: {
    type: String,
    required: false,
  },
});

AuthorSchema.index({ orgID: 1, nameKey: 1 }, { unique: true }); // Ensure nameKey is unique within an orgID


const Author = model<AuthorInterface>("Author", AuthorSchema);

export default Author;
