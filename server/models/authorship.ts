import { Document, model, Schema } from "mongoose";
import { CREDIT_ROLES, type CreditRole } from "../util/author-tags.js";

/**
 * A credit tag as it appears on a library page: its role (author, editor, …), the tag prefix it
 * was read from, and its raw value. Tags written by the Attribution Manager hold an author key
 * (`editor@<key>`); older ones may hold display text (`author@<Name>`) or be `authorname:<key>`.
 */
export type AuthorshipAuthorRef = {
  role: CreditRole;
  tag: string;
  value: string;
};

export type AuthorshipPageStatus = "pending" | "completed" | "failed";

/** Bumped when the stored page shape changes; documents with an older version are rescanned. */
export const AUTHORSHIP_DOC_VERSION = 2;

export interface AuthorshipPage {
  id: string;
  title: string;
  url: string;
  /** The page's own credit tags, every role. */
  pageCredits?: AuthorshipAuthorRef[];
  /** For a transcluded page, the credit tags of the page it points at. */
  sourceCredits?: AuthorshipAuthorRef[];
  /** Credit tags of the pages whose content is reused inside this page. */
  contentCredits?: AuthorshipAuthorRef[];
  /** Set once the page's body has been scanned; a tags-only refresh keeps the content fields. */
  contentScanned?: boolean;
  status: AuthorshipPageStatus;
}

/** Progress of the most recent background bulk author update. */
export interface AuthorshipBulkJob {
  jobID: string;
  status: "running" | "completed" | "failed";
  total: number;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
}

export interface AuthorshipInterface extends Document {
  projectID: string;
  version?: number;
  createdBy: string;
  updatedBy: string;
  pages: AuthorshipPage[];
  processing: boolean;
  /** Owner of the `processing` lock, so a superseded run can't write or release it. */
  processingLockID?: string;
  /** Refreshed while the lock is held; a stale value means the holder died. */
  processingHeartbeatAt?: Date;
  bulkJob?: AuthorshipBulkJob;
}

const AuthorRefSchema = new Schema<AuthorshipAuthorRef>(
  {
    role: { type: String, enum: CREDIT_ROLES, required: true },
    tag: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const AuthorshipPageSchema = new Schema<AuthorshipPage>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    pageCredits: { type: [AuthorRefSchema], required: false, default: undefined },
    sourceCredits: { type: [AuthorRefSchema], required: false, default: undefined },
    contentCredits: { type: [AuthorRefSchema], required: false, default: undefined },
    contentScanned: { type: Boolean, required: false },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      required: true,
      default: "pending",
    },
  },
  { _id: false },
);

const AuthorshipSchema = new Schema<AuthorshipInterface>(
  {
    projectID: { type: String, required: true, unique: true },
    version: { type: Number, required: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    pages: { type: [AuthorshipPageSchema], required: true },
    processing: { type: Boolean, required: true, default: false },
    processingLockID: { type: String, required: false },
    processingHeartbeatAt: { type: Date, required: false },
    bulkJob: {
      type: new Schema<AuthorshipBulkJob>(
        {
          jobID: { type: String, required: true },
          status: { type: String, enum: ["running", "completed", "failed"], required: true },
          total: { type: Number, required: true, default: 0 },
          processed: { type: Number, required: true, default: 0 },
          updated: { type: Number, required: true, default: 0 },
          failed: { type: Number, required: true, default: 0 },
          skipped: { type: Number, required: true, default: 0 },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

const Authorship = model<AuthorshipInterface>("Authorship", AuthorshipSchema);

export default Authorship;
