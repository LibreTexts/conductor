/**
 * @file Defines a Mongoose schema for "What's New in Conductor" entries — the
 *  admin-authored release notices shown to users in a one-time modal.
 * @author LibreTexts <info@libretexts.org>
 */

import { model, Schema, Document } from "mongoose";

/**
 * Default staleness window. An entry published longer ago than this stops being
 * served, on the theory that the features it announces are no longer novel.
 * Overridable per entry via `staleAfterDays`.
 */
export const WHATS_NEW_DEFAULT_STALE_DAYS = 90;

export const WHATS_NEW_STATUSES = ["draft", "published", "archived"] as const;

export type WhatsNewStatus = (typeof WHATS_NEW_STATUSES)[number];

export interface WhatsNewInterface extends Document {
  title: string;
  body: string;
  status: WhatsNewStatus;
  publishedAt?: Date;
  expiresAt?: Date;
  staleAfterDays?: number;
  ctaLabel?: string;
  ctaUrl?: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsNewSchema = new Schema<WhatsNewInterface>(
  {
    /**
     * Plain-text headline, rendered as the modal title. Lead with user impact
     * rather than the feature name.
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * Markdown source of the notice body. Rendered client-side with
     * react-markdown, which does not render raw HTML, so this is not an
     * injection vector.
     */
    body: {
      type: String,
      required: true,
    },
    /**
     * Only `published` entries are ever served to users. `draft` is the
     * authoring state; `archived` retires an entry without deleting it.
     */
    status: {
      type: String,
      enum: WHATS_NEW_STATUSES,
      required: true,
      default: "draft",
    },
    /**
     * Datetime the entry was FIRST published. This is the ordering key (a newer
     * entry supersedes an older one) and the staleness key. Deliberately not
     * touched by later edits, so fixing a typo does not re-notify every user.
     */
    publishedAt: Date,
    /**
     * Optional hard stop chosen by the author. Applies regardless of the
     * staleness window.
     */
    expiresAt: Date,
    /**
     * Optional per-entry override of WHATS_NEW_DEFAULT_STALE_DAYS.
     */
    staleAfterDays: Number,
    /**
     * Optional single call-to-action. Both fields are required together or not
     * at all; the validator enforces the pairing.
     */
    ctaLabel: String,
    ctaUrl: String,
    /**
     * UUID of the user who created the entry.
     */
    author: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Serves the active-entry query (status + publishedAt window, newest first)
// entirely from the index.
WhatsNewSchema.index({ status: 1, publishedAt: -1 });

const WhatsNew = model<WhatsNewInterface>("WhatsNew", WhatsNewSchema);

export default WhatsNew;
