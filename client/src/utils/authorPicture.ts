/**
 * Shown for an individual author with no picture of their own (keep in step with the server's
 * DEFAULT_AUTHOR_PICTURE_URL). It is never saved to the record. Groups get no default: one
 * person's silhouette would misrepresent several people.
 */
export const DEFAULT_AUTHOR_PICTURE_URL =
  "https://biz.libretexts.org/@api/deki/files/5084/girl-160172__340.png";

/** The picture to show for an author: their own, else the default for an individual. */
export function authorPictureURL(author?: {
  pictureURL?: string;
  groupMembers?: unknown[];
}): string | undefined {
  if (!author) return undefined;
  if (author.pictureURL) return author.pictureURL;
  return author.groupMembers?.length ? undefined : DEFAULT_AUTHOR_PICTURE_URL;
}
