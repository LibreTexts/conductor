import { model, Schema, Document, Types } from "mongoose";
import { PROJECT_FILES_ACCESS_SETTINGS } from "../util/projectutils.js";
import { AuthorInterface } from "./author.js";

// Not stored in schema, but used in API
export type FileInterfacePath = {
  fileID: string;
  name: string;
};

export type FileInterfaceAccess =
  | "public"
  | "users"
  | "instructors"
  | "team"
  | "mixed";

export interface FileLicense {
  name?: string;
  url?: string;
  version?: string;
  sourceURL?: string;
  modifiedFromSource?: boolean;
  additionalTerms?: string;
}

export type FileAuthor = Omit<AuthorInterface, "userUUID"> | Types.ObjectId;

export interface FilePublisher {
  name?: string;
  url?: string;
}

export interface RawFileInterface {
  fileID: string;
  name?: string;
  access?: FileInterfaceAccess;
  storageType: "file" | "folder";
  size: number;
  isURL?: boolean;
  url?: string;
  description?: string;
  parent?: string;
  createdBy?: string;
  downloadCount?: number;
  license?: FileLicense;
  authors?: FileAuthor[];
  publisher?: FilePublisher;
  mimeType?: string;
  version?: number;
}

export interface FileInterface extends RawFileInterface, Document {}

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
   * Indicates whether the entry is a URL or not.
   */
  isURL: {
    type: Boolean,
    default: false,
  },
  /**
   * URL of the entry, if entry is a URL.
   */
  url: String,
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
  /**
   * License information for the entry.
   */
  license: {
    name: String,
    url: String,
    version: String,
    sourceURL: String,
    modifiedFromSource: Boolean,
    additionalTerms: String,
  },
  /**
   * Author information for the entry.
   */
  authors: {
    type: [Schema.Types.Mixed],
    required: false,
  },
  /**
   * Publisher information for the entry.
   */
  publisher: {
    name: String,
    url: String,
  },
  /**
   * MIME type of the entry.
   */
  mimeType: String,
  /**
   * Version of the entry.
   */
  version: Number,
});

// We don't need export Mongoose model()  here because we only need the schema, not a seperate collection.
export default FileSchema;
