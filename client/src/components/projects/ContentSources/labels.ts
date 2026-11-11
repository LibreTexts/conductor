import type { BadgeVariant } from "@libretexts/davis-react";
import type {
  PageNodeKind,
  ReuseEdgeStatus,
  ReuseEdgeType,
} from "../../../types/ContentSources";

/** How a page's content is made, in plain words. */
export const KIND_LABELS: Record<PageNodeKind, string> = {
  original: "Original",
  transclude: "Transcluded",
  fork: "Forked copy",
  full: "Full copy",
  mixed: "Original with reused sections",
  structural: "Structural",
  unknown: "Not scanned",
};

export const KIND_DESCRIPTIONS: Record<PageNodeKind, string> = {
  original: "Written in this book; reuses nothing.",
  transclude: "Shows another page's content live; edits to the source appear here.",
  fork: "A one-time copy of another page; it doesn't follow later edits.",
  full: "A one-time copy of another page and its files; it doesn't follow later edits.",
  mixed: "Has its own text plus sections shown live from other pages.",
  structural: "Cover, table of contents, front or back matter.",
  unknown: "The scanner hasn't read this page yet.",
};

/** How a page reuses one source. */
export const EDGE_TYPE_LABELS: Record<ReuseEdgeType, string> = {
  "transclude-same": "Transcluded",
  "transclude-cross": "Transcluded from another library",
  section: "Embedded section",
  fork: "Forked copy",
  full: "Full copy",
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
