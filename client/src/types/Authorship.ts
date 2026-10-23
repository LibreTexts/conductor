/** An author resolved from a tag value that is an author key. */
export type AuthorshipAuthor = {
  nameKey: string;
  name: string;
  nameURL?: string;
  campusName?: string;
  isGroup: boolean;
};

/** Credit roles, as written in tags (`<role>@<authorKey>`). Keep in step with the server. */
export type CreditRole =
  | "author"
  | "editor"
  | "remixer"
  | "translator"
  | "contributor"
  | "illustrator"
  | "reviewedBy";

/**
 * A credit tag found on a library page. `author` is set when `value` is the key of an existing
 * author; otherwise `value` is shown as written (e.g. an older `author@<Name>` tag).
 */
export type AuthorshipAuthorRef = {
  role: CreditRole;
  /** The tag prefix it was read from: `<role>@`, or `authorname:` for older author tags. */
  tag: string;
  value: string;
  author?: AuthorshipAuthor;
};

export type AuthorshipStatus = "pending" | "completed" | "failed";

export type AuthorshipEntry = {
  id: string;
  title: string;
  url: string;
  status: AuthorshipStatus;
  /** The page's own credit tags, every role. */
  pageCredits: AuthorshipAuthorRef[];
  /** For a transcluded page, the credit tags of the page it points at. */
  sourceCredits: AuthorshipAuthorRef[];
  /** Credit tags of content reused inside the page. */
  contentCredits: AuthorshipAuthorRef[];
};

export type AuthorshipBulkJob = {
  jobID: string;
  status: "running" | "completed" | "failed";
  total: number;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
};

/** One row of the anonymous author search. */
export type AuthorSearchResult = AuthorshipAuthor;
