import { Document, model, Schema } from "mongoose";

export interface LibraryInterface extends Document {
  subdomain: string;
  title: string;
  link: string;
  thumbnail: string;
  glyphURL?: string;
  guideTabTemplates?: Record<string, string>;
  centralIdentityAppId: number;
  hidden: boolean;
  syncSupported: boolean;
}

const LibrarySchema = new Schema(
  {
    subdomain: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    glyphURL: {
      type: String,
      required: false,
    },
    guideTabTemplates: {
      type: Map,
      of: String,
      required: false,
    },
    centralIdentityAppId: {
      type: Number,
      required: true,
      unique: true,
    },
    hidden: {
      type: Boolean,
      required: true,
    },
    syncSupported: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true },
);

LibrarySchema.index({ subdomain: 1 });

const Library = model<LibraryInterface>("Library", LibrarySchema);

export default Library;
