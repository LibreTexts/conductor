export const WHATS_NEW_STATUSES = ["draft", "published", "archived"] as const;

export type WhatsNewStatus = (typeof WHATS_NEW_STATUSES)[number];

/**
 * A "What's New in Conductor" entry as served to a regular user. The server
 * projects away authoring fields on the public read route.
 */
export type WhatsNewEntry = {
  _id: string;
  title: string;
  /** Markdown source. Rendered with react-markdown, which does not emit raw HTML. */
  body: string;
  publishedAt: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/** The full record, as returned to the authoring UI. */
export type WhatsNewEntryAdmin = WhatsNewEntry & {
  status: WhatsNewStatus;
  publishedAt?: string;
  expiresAt?: string;
  staleAfterDays?: number;
  author: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Payload for creating or updating an entry. `expiresAt` and `staleAfterDays`
 * accept `null` to clear the stored value.
 */
export type WhatsNewEntryPayload = {
  title?: string;
  body?: string;
  status?: WhatsNewStatus;
  expiresAt?: string | null;
  staleAfterDays?: number | null;
  ctaLabel?: string;
  ctaUrl?: string;
};

/**
 * What the acknowledgment system stores under the `whats_new` key's `data`.
 * This is the seen-watermark: the newest entry the user has dismissed. One
 * permanent key therefore covers an unbounded stream of entries.
 */
export type WhatsNewWatermark = {
  lastEntryId: string;
  lastPublishedAt: string;
};
