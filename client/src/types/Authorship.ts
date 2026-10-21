/** An author resolved from a tag value that is an author key. */
export type AuthorshipAuthor = {
  nameKey: string;
  name: string;
  nameURL?: string;
  campusName?: string;
  isGroup: boolean;
};

/**
 * An author tag found on a library page. `author` is set when `value` is the key of an existing
 * author; otherwise `value` is shown as written (e.g. an older `author@<Name>` tag).
 */
export type AuthorshipAuthorRef = {
  tag: "author@" | "authorname:";
  value: string;
  author?: AuthorshipAuthor;
};

export type AuthorshipStatus = "pending" | "completed" | "failed";

export type AuthorshipEntry = {
  id: string;
  title: string;
  url: string;
  status: AuthorshipStatus;
  pageAuthors: AuthorshipAuthorRef[];
  sourceAuthor?: AuthorshipAuthorRef;
  contentAuthors: AuthorshipAuthorRef[];
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
