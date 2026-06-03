import base62 from "base62-random";
import { Document, model, Schema } from "mongoose";

export interface RemixerSubPageState {
  "@id": string;
  "@title": string;
  "@href": string;
  "@subpages": boolean;
  article: "article" | "topic-category" | "topic-guide";
  parentID?: string;
  namespace: string;
  title: string;
  "uri.ui": string;
  originalPathNumber?: string[];
  pathNumber?: string[];
  numberedPath?: string;
  formattedPath?: string;
  formattedPathOverride?: boolean;
  isDeleted?: boolean;
  isImported?: boolean;
  isRenamed?: boolean;
  isPlacementChanged?: boolean;
  addedItem?: boolean;
  movedItem?: boolean;
  renamedItem?: boolean;
  deletedItem?: boolean;
  sourceID?: string;
}

export interface PathLevelFormatState {
  level: number;
  excludeParent?: boolean;
  delimiter?: string;
  prefix: string;
  start: number;
  type: "numeric" | "alphabetic" | "roman" | "none";
}

export interface PrejectRemixerInterface extends Document {
  projectID: string;
  remixerID: string;
  createdBy: string;
  updatedBy: string;
  remixerCurrentBook: RemixerSubPageState[];
  autoNumbering?: boolean;
  copyModeState?: string;
  pathLevelFormats?: PathLevelFormatState[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

const RemixerSubPageStateSchema = new Schema<RemixerSubPageState>(
  {
    "@id": { type: String, required: true },
    "@title": { type: String, required: true },
    "@href": { type: String, required: true },
    "@subpages": { type: Boolean, required: true },
    article: { type: String, required: true },
    parentID: { type: String },
    namespace: { type: String, required: true },
    title: { type: String, required: true },
    "uri.ui": { type: String, required: true },
    originalPathNumber: [{ type: String }],
    pathNumber: [{ type: String }],
    numberedPath: { type: String },
    formattedPath: { type: String },
    formattedPathOverride: { type: Boolean },
    isDeleted: { type: Boolean },
    isImported: { type: Boolean },
    isRenamed: { type: Boolean },
    isPlacementChanged: { type: Boolean },
    addedItem: { type: Boolean },
    movedItem: { type: Boolean },
    renamedItem: { type: Boolean },
    deletedItem: { type: Boolean },
  },
  {
    _id: false,
    strict: false,
  },
);

const PathLevelFormatSchema = new Schema<PathLevelFormatState>(
  {
    level: { type: Number, required: true },
    excludeParent: { type: Boolean },
    delimiter: { type: String },
    prefix: { type: String, required: true, default: "" },
    start: { type: Number, required: true, default: 1 },
    type: { type: String, required: true, default: "numeric" },
  },
  { _id: false },
);

const PrejectRemixerSchema = new Schema<PrejectRemixerInterface>(
  {
    projectID: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      default: "",
    },
    updatedBy: {
      type: String,
      required: true,
      default: "",
    },
    remixerCurrentBook: {
      type: [RemixerSubPageStateSchema],
      default: () => [],
    },
    autoNumbering: { type: Boolean },
    copyModeState: { type: String },
    pathLevelFormats: { type: [PathLevelFormatSchema], default: () => [] },
    archived:{type:Boolean, default:false},
    remixerID: {
      type: String,
      required: true,
      default: base62(10),
    },
  },
  {
    timestamps: true,
  },
);

// Only one active (non-archived) remixer state is allowed per project;
// archived historical snapshots can accumulate freely.
PrejectRemixerSchema.index(
  { projectID: 1 },
  { unique: true, partialFilterExpression: { archived: false } },
);

const PrejectRemixer = model<PrejectRemixerInterface>(
  "PrejectRemixer",
  PrejectRemixerSchema,
  "prejectremixer",
);

export default PrejectRemixer;
