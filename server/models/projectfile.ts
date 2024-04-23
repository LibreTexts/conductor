import { model, Schema, Document } from "mongoose";

export const PROJECT_FILES_ACCESS_SETTINGS = [
  "public",
  "users",
  "instructors",
  "team",
  "mixed",
];

// Not stored in schema, but used in API
export type ProjectFileInterfacePath = {
  fileID: string;
  name: string;
};

export type ProjectFileInterfaceAccess =
  | "public"
  | "users"
  | "instructors"
  | "team"
  | "mixed";

export interface ProjectFileLicense {
  name?: string;
  url?: string;
  version?: string;
  sourceURL?: string;
  modifiedFromSource?: boolean;
  additionalTerms?: string;
}

export interface ProjectFilePublisher {
  name?: string;
  url?: string;
}

export interface RawProjectFileInterface {
  fileID: string;
  projectID: string;
  name?: string;
  access?: ProjectFileInterfaceAccess;
  storageType: "file" | "folder";
  size: number;
  isURL?: boolean;
  url?: string;
  isVideo?: boolean;
  videoStorageID?: string;
  description?: string;
  parent?: string;
  createdBy?: string;
  downloadCount?: number;
  license?: ProjectFileLicense;
  primaryAuthor?: Schema.Types.ObjectId;
  authors?: (Schema.Types.ObjectId)[];
  correspondingAuthor?: Schema.Types.ObjectId;
  publisher?: ProjectFilePublisher;
  mimeType?: string;
  version?: number;
  tags?: (Schema.Types.ObjectId)[];
}

export interface ProjectFileInterface extends RawProjectFileInterface, Document {}

const ProjectFileSchema = new Schema<ProjectFileInterface>({
  /**
   * Unique identifier of the file entry.
   */
  fileID: {
    type: String,
    required: true,
    index: true,
  },
  /**
   * Unique identifier of the project the file entry belongs to.
   */
  projectID: {
    type: String,
    required: true,
    index: true,
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
   * Indicates the entry is a video and should be stored/retrieved from video streaming storage.
   */
  isVideo: {
    type: Boolean,
    default: false,
  },
  /**
   * The video streaming storage identifier, if entry is a video.
   */
  videoStorageID: String,
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
   * Primary author information for the entry.
   */
  primaryAuthor: {
    type: Schema.Types.ObjectId,
    required: false,
  },
  /**
   * Author information for the entry.
   */
  authors: {
    type: [Schema.Types.ObjectId],
    required: false,
  },
  /**
   * Corresponding author information for the entry.
   */
  correspondingAuthor: {
    type: Schema.Types.ObjectId,
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
  /**
   * List of tags associated with the entry.
   */
  tags: {
    type: [Schema.Types.ObjectId],
    required: false,
  },
});

const ProjectFile = model<ProjectFileInterface>("ProjectFile", ProjectFileSchema);

export default ProjectFile;
