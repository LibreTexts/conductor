/**
 * Heading anchors for Insight articles, client side.
 *
 * The server stamps an `id` onto every heading when an article is saved (see
 * `server/util/kb-headings.ts`), so rendered content normally arrives with its
 * anchors already in place. These helpers cover the cases where it does not:
 * the editor's live preview, and any article not yet re-saved at the time the
 * page is viewed.
 *
 * {@link slugifyHeading} is a copy of the server function of the same name and
 * MUST produce identical output — otherwise a preview and the saved article
 * would disagree about what a section's link is. Change the two together.
 */

export type ArticleHeading = {
  id: string;
  text: string;
  /** 2 for `<h2>`, 3 for `<h3>`. */
  level: number;
};

/** Longest generated id, before any de-duplication suffix. */
const MAX_SLUG_LENGTH = 80;

/**
 * Turns heading text into a URL fragment. Mirrors `slugifyHeading` in
 * `server/util/kb-headings.ts` — keep the two in sync.
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  if (!slug || /^[0-9]/.test(slug)) return `section-${slug || "1"}`;
  return slug;
}

/**
 * Returns a function that hands out unique heading ids for one render pass.
 *
 * An id already on the heading is handed straight back, so saved anchors are
 * never rewritten. Generated ids are de-duplicated with `-2`, `-3`, … against
 * everything the same pass has already issued, matching what the server does
 * on save.
 */
export function createHeadingIdFactory() {
  const used = new Set<string>();

  return (text: string, existingId?: string): string => {
    if (existingId) {
      used.add(existingId);
      return existingId;
    }

    const base = slugifyHeading(text);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  };
}

/** The absolute, shareable URL for a section of the article being viewed. */
export function headingLink(id: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${id}`;
}
