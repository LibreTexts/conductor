import type { BadgeVariant } from "@libretexts/davis-react";
import type {
  PageNodeKind,
  ReuseEdgeStatus,
  ReuseEdgeType,
} from "../../../types/ContentSources";

/**
 * How a page's content is made. The three copy kinds use the Remixer's own
 * names for its copy modes (`copyModeStates` in `components/remixer/model.ts`).
 */
export const KIND_LABELS: Record<PageNodeKind, string> = {
  original: "Original",
  transclude: "Copy-Transclude",
  fork: "Copy-Fork",
  full: "Copy-Full",
  mixed: "Reused content",
  structural: "Structural",
  unknown: "Not scanned",
};

export const KIND_DESCRIPTIONS: Record<PageNodeKind, string> = {
  original: "Written in its own book; reuses nothing.",
  transclude: "Shows another page's content live; edits to the source appear here.",
  fork: "A one-time copy of another page's content, without its files; it doesn't follow later edits.",
  full: "A one-time copy of another page's content and its files (images, attachments); it doesn't follow later edits.",
  mixed: "Its own text plus part of other pages: sections shown live from them, or blocks of text copied from them.",
  structural: "Cover, table of contents, front or back matter.",
  unknown: "The scanner hasn't read this page yet.",
};

/** Page kinds counted in the summaries, in display order. */
export const SUMMARY_KINDS = ["original", "mixed", "transclude", "fork", "full"] as const satisfies readonly PageNodeKind[];

/** Tooltips for the summary cards that aren't a page kind. */
export const CARD_TIPS = {
  pages: "Every page the scan found in this book, structural pages included.",
  pagesAll: "Every page the scan found in these books, structural pages included.",
  books: "Books the scan has read so far.",
  viaChain:
    "Pages whose content comes through another page that itself reuses it: page A is reused by B, and B by this page.",
  broken: "Live reuse of a page that was deleted: readers see nothing where its content was.",
} as const;

/** How a page reuses one source. */
export const EDGE_TYPE_LABELS: Record<ReuseEdgeType, string> = {
  "transclude-same": "Copy-Transclude",
  "transclude-cross": "Copy-Transclude (another library)",
  section: "Embedded section (live)",
  fork: "Copy-Fork",
  full: "Copy-Full",
  excerpt: "Copied excerpt",
};

/** Live reuse follows the source; copies don't. */
export const isLiveType = (type: ReuseEdgeType) =>
  type === "transclude-same" || type === "transclude-cross" || type === "section";

export const STATUS_BADGES: Record<
  ReuseEdgeStatus,
  { label: string; variant: BadgeVariant }
> = {
  active: { label: "Current", variant: "success" },
  "source-changed": { label: "Source changed", variant: "warning" },
  broken: { label: "Source deleted", variant: "danger" },
  removed: { label: "No longer reused", variant: "default" },
};

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;
