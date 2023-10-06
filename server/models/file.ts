import { model, Schema, Document } from "mongoose";
import { PROJECT_FILES_ACCESS_SETTINGS } from "../util/projectutils.js";
import { AssetTagInterface } from "./assettag.js";

export interface FileInterface extends Document {
  fileID: string;
  name?: string;
  access?: "public" | "users" | "instructors" | "team" | "mixed";
  storageType: "file" | "folder";
  size: number;
  description?: string;
  parent?: string;
  createdBy?: string;
  downloadCount?: number;
  tags?: Schema.Types.ObjectId[] | AssetTagInterface[];
}

const FileSchema = new Schema<FileInterface>({
  /**
   * Unique identifier of the file entry.
   */
  fileID: {
    type: String,
    required: true,
  },
  /**
   * UI-name of the file entry.
   */
  name: String,
  /**
   * Indicates which users can download the file on Commons.
   */
  access: {
    type: String,
    enum: PROJECT_FILES_ACCESS_SETTINGS,
  },
  /**
   * Indicates whether the entry is a "file" or "folder".
   */
  storageType: {
    type: String,
    enum: ["file", "folder"],
    default: "file",
  },
  /**
   * Entry size in bytes, set to 0 if entry is a "folder".
   */
  size: {
    type: Number,
    default: 0,
  },
  /**
   * UI text describing the entry and its contents.
   */
  description: String,
  /**
   * Identifier of the immediate parent in the hierarchy. Empty string if the
   * entry is at the top-level of the hierarchy.
   */
  parent: String,
  /**
   * UUID of the user that uploaded or created the entry.
   */
  createdBy: String,
  /**
   * Number of times the entry has been downloaded on Commons, if entry is a "file".
   */
  downloadCount: Number,
  tags: [
    {
      type: [Schema.Types.ObjectId],
      ref: "AssetTag",
      required: false,
    }
  ]
});

// We don't need export Mongoose model()  here because we only need the schema, not a seperate collection.
export default FileSchema;