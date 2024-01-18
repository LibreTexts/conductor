import { Schema, model } from "mongoose";

export interface AuthorInterface extends Document {
  firstName: string;
  lastName: string;
  email?: string;
  url?: string;
  primaryInstitution?: string;
  userUUID?: string;
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
    unique: true,
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
});

const Author = model<AuthorInterface>("Author", AuthorSchema);

export default Author;
