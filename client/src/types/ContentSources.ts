/**
 * Project Content Sources: where a project's book takes its content from, who
 * reuses it, and what changed. Mirrors server/api/services/content-sources-service.ts.
 */

export type ReuseEdgeType =
  | "transclude-same"
  | "transclude-cross"
  | "section"
  | "fork"
  | "full"
  /** Blocks copied from the source (`lt-{lib}-{id}` classes); frozen like a fork. */
  | "excerpt";

export type ReuseEdgeStatus = "active" | "source-changed" | "broken" | "removed";

export type ReuseEdgeOrigin = "remixer" | "scan" | "fingerprint" | "manual";

export type PageNodeKind =
  | "original"
  | "transclude"
  | "fork"
  | "full"
  | "mixed"
  | "structural"
  | "unknown";

/** A page or book. `id` is `${lib}-${pageID}` (a bookID is its cover page's id). */
export type ContentSourcesRef = {
  id: string;
  lib: string | null;
  title: string;
  url: string | null;
};

export type ContentSourcesBookLink = ContentSourcesRef & {
  pages: number;
  types: ReuseEdgeType[];
};

export type ContentSourcesUnscannedGroup = {
  lib: string;
  pages: number;
  sources: number;
  types: ReuseEdgeType[];
  examples: string[];
  exampleRefs: ContentSourcesRef[];
};

export type ContentSourcesRecentChange = {
  /** The change event, for marking it reviewed. */
  eventID: string;
  source: ContentSourcesRef;
  fromRev?: number;
  toRev?: number;
  deleted: boolean;
  changedAt: string;
  pages: number;
  frozen: boolean;
  notified: boolean;
};

export type ContentSourcesTotals = {
  pages: number;
  original: number;
  transclude: number;
  fork: number;
  full: number;
  mixed: number;
  structural: number;
  unknown: number;
  viaChain: number;
};

export type ContentSourcesOverview = {
  bookID: string;
  book: ContentSourcesRef;
  scanned: boolean;
  computedAt: string | null;
  totals: ContentSourcesTotals | null;
  upstream: ContentSourcesBookLink[];
  downstream: ContentSourcesBookLink[];
  unscannedSources: ContentSourcesUnscannedGroup[];
  attention: { sourceChanged: number; broken: number };
  recentChanges: ContentSourcesRecentChange[];
  canManage: boolean;
};

export type ContentSourcesPageSource = ContentSourcesRef & {
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  status: ReuseEdgeStatus;
  /** For a copied excerpt: how many of the page's blocks came from the source. */
  blocks?: number;
};

export type ContentSourcesPage = ContentSourcesRef & {
  pageID: number;
  /** Nesting in the book: 0 = cover, 1 = top-level pages, ... */
  depth: number;
  kind: PageNodeKind;
  reuseDepth: number;
  rootSource: ContentSourcesRef | null;
  reuseCycle: boolean;
  sources: ContentSourcesPageSource[];
};

export type ContentSourcesPagesResult = {
  total: number;
  /** The book has more pages than one response carries. */
  truncated: boolean;
  /** In table-of-contents order. */
  pages: ContentSourcesPage[];
};

export type ContentSourcesLineageStep = {
  source: ContentSourcesRef;
  target: ContentSourcesRef;
  type: ReuseEdgeType;
  status: ReuseEdgeStatus;
  hops: number;
};

export type ContentSourcesLineage = {
  page: ContentSourcesRef;
  steps: ContentSourcesLineageStep[];
  truncated: boolean;
};

/** One library revision of a changed source page. */
export type ContentSourcesRevision = {
  revision: number;
  editedAt: string | null;
  author: string | null;
  /** The revision's message, e.g. "5 words added". */
  summary: string;
  /** Part of the change under review (after `fromRev`, up to `toRev`). */
  inChange: boolean;
};

/** A source change's page history, and the diff between the change's two ends. */
export type ContentSourcesChangeRevisions = {
  source: ContentSourcesRef;
  fromRev?: number;
  toRev?: number;
  deleted: boolean;
  /** The source page's revisions, newest first. */
  revisions: ContentSourcesRevision[];
  /** Sanitized HTML with <ins>/<del> marks; null when unavailable. */
  diffHtml: string | null;
};

/** One revision of a change's source page, read in Conductor. */
export type ContentSourcesRevisionDetail = {
  source: ContentSourcesRef;
  revision: ContentSourcesRevision;
  /** The revision `diffHtml` compares against; null for the page's first. */
  previous: number | null;
  /** The page as it was at this revision, sanitized; null when unavailable. */
  contentHtml: string | null;
  /** What this revision changed from `previous`, sanitized; null when unavailable. */
  diffHtml: string | null;
};

/** Reuse totals and scan progress for one library (LibreTexts staff view). */
export type LibraryReuseStats = {
  library: string;
  books: number;
  totals: ContentSourcesTotals;
  booksReusing: number;
  booksReused: number;
  scan: {
    phase: string;
    lastRunAt: string | null;
    lastCompletedAt: string | null;
    running: boolean;
    stats: {
      scanned: number;
      skipped: number;
      edgesAdded: number;
      edgesRemoved: number;
      errors: number;
    } | null;
  } | null;
  brokenLinks: number;
  /** The changes job's reading of this library's change feed. */
  feed: {
    polledAt: string | null;
    /** The last read skipped events; safety nets were queued. */
    gapAt: string | null;
    /** Books waiting to be re-read. */
    pendingBooks: number;
  } | null;
};

export type BookGraphNode = ContentSourcesRef & {
  /** `library` stands for every not-yet-scanned book of one library. */
  kind: "book" | "library";
  pages: number | null;
  degree: number;
};

/** `target` reuses `pages` pages from `source`. */
export type BookGraphEdge = {
  source: string;
  target: string;
  pages: number;
  types: ReuseEdgeType[];
};

export type BookGraph = {
  nodes: BookGraphNode[];
  edges: BookGraphEdge[];
  omittedEdges: number;
};
