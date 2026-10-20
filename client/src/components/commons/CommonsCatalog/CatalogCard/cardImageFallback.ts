/**
 * Shared cover/thumbnail fallback for every catalog card.
 *
 * Library thumbnails and collection covers are remote URLs recorded at sync
 * time, so a record can outlive its image. Without a fallback the card paints
 * the browser's broken-image glyph.
 */

/** Shown when a record has no cover set or its cover fails to load. */
export const COVER_PLACEHOLDER = "/mini.logo.png";

/**
 * Swaps a failed cover for the placeholder. The guard stops a missing
 * placeholder from looping the error handler forever.
 */
export function handleCoverError(
  event: React.SyntheticEvent<HTMLImageElement>
) {
  if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER)) return;
  event.currentTarget.src = COVER_PLACEHOLDER;
}
