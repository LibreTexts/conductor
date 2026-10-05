/**
 * Shared registry of stable acknowledgment ids for the per-user UX
 * record-keeping system. Register every one-off UI prompt (dismissible banner,
 * welcome dialog, tour, hint) here.
 *
 * Rules for keys:
 *   - snake_case, NO dots (MongoDB map keys use `.` as a path separator) and no `$`.
 *   - stable/permanent once shipped — renaming loses users' history.
 *
 * This file is intentionally duplicated on the client at
 * `client/src/utils/uxAcknowledgmentKeys.ts`. Keep the two in sync.
 */
export const UX_ACKNOWLEDGMENT_KEYS = {
  COAUTHOR_WELCOME: "coauthor_welcome",
  COAUTHOR_TOOLS_MOVED: "coauthor_tools_moved",
  /**
   * The recurring "What's New in Conductor" modal. Unlike every other key here,
   * this one is a WATERMARK rather than a one-off flag: its `data` holds the id
   * of the most recent entry the user dismissed, so a single permanent key
   * serves an unbounded stream of admin-authored entries. See useWhatsNew.
   */
  WHATS_NEW: "whats_new",
} as const;

export type UXAcknowledgmentKey =
  (typeof UX_ACKNOWLEDGMENT_KEYS)[keyof typeof UX_ACKNOWLEDGMENT_KEYS];

export const UX_ACKNOWLEDGMENT_KEY_VALUES: readonly string[] =
  Object.values(UX_ACKNOWLEDGMENT_KEYS);
