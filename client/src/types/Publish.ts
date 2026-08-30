/**
 * The publishing flow's steps, in the order they are presented.
 * Mirrors `PublishStepKey` in `server/models/project.ts`.
 */
export type PublishStepKey =
  | "preprocess"
  | "security"
  | "move"
  | "visibility"
  | "compile";

export type PublishStepStatus =
  | "not-started"
  | "running"
  | "succeeded"
  | "failed";

/**
 * One step's recorded outcome.
 *
 * `jobID` is only present for the steps that hand work to another system
 * (editor-preprocess, Shapeshift); `detail` carries the step's own result,
 * which today is the destination path the move wrote.
 */
export type PublishStepState = {
  status: PublishStepStatus;
  startedAt?: string;
  finishedAt?: string;
  /** UUID of the user who ran the step. */
  actor?: string;
  jobID?: string;
  detail?: string;
  errorMessage?: string;
};

/** A location the book can be moved into, relative to the library root. */
export type PublishDestination = {
  title: string;
  path: string;
  hasChildren: boolean;
};

export type PublishStatus = {
  bookID: string | null;
  library: string | null;
  coverID: string | null;
  /** Where the coverpage currently sits, read live from the library. */
  currentPath: string | null;
  /** The coverpage's current MindTouch restriction, read live. */
  restriction: string | null;
  visibility: "public" | "private";
  steps: Record<PublishStepKey, PublishStepState>;
  preprocessPercentage?: number;
  isPublished: boolean;
};

export const PUBLISH_STEP_ORDER: PublishStepKey[] = [
  "preprocess",
  "security",
  "move",
  "visibility",
  "compile",
];
