import { Document, model, Schema } from "mongoose";

/**
 * An author tag as it appears on a library page. `value` is the raw tag value: an author key
 * for tags written by the Authorship tool (`author@<key>`), or whatever an older tag holds
 * (`authorname:<key>`, or `author@<Name>` display text).
 */
export type AuthorshipAuthorRef = {
  tag: "author@" | "authorname:";
  value: string;
};

export type AuthorshipPageStatus = "pending" | "completed" | "failed";

export interface AuthorshipPage {
  id: string;
  title: string;
  url: string;
  /**
   * The page's own author tags: every `author@` tag, or failing that its `authorname:` tag.
   * Older pages can carry several `author@` tags (one per name); the Authorship tool writes one.
   */
  pageAuthors?: AuthorshipAuthorRef[];
  /** For a transcluded page, the author tag of the page it points at. */
  sourceAuthor?: AuthorshipAuthorRef;
  /** Author tags of the pages whose content is reused inside this page. */
  contentAuthors?: AuthorshipAuthorRef[];
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
    tag: { type: String, enum: ["author@", "authorname:"], required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const AuthorshipPageSchema = new Schema<AuthorshipPage>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    pageAuthors: { type: [AuthorRefSchema], required: false, default: undefined },
    sourceAuthor: { type: AuthorRefSchema, required: false },
    contentAuthors: { type: [AuthorRefSchema], required: false, default: undefined },
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
