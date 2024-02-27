import { Schema, model } from "mongoose";

export interface AuthorInterface extends Document {
  firstName: string;
  lastName: string;
  email?: string;
  url?: string;
  primaryInstitution?: string;
  userUUID?: string;
  isAdminEntry?: boolean;
}

const AuthorSchema = new Schema<AuthorInterface>({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: false,
  },
  url: {
    type: String,
    required: false,
  },
  primaryInstitution: {
    type: String,
    required: false,
  },
  userUUID: {
    type: String,
    required: false,
  },
  isAdminEntry: {
    type: Boolean,
    required: false,
  },
});

// Email is unique, but not required
AuthorSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true } } }
);

const Author = model<AuthorInterface>("Author", AuthorSchema);

export default Author;
