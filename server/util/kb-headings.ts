import * as cheerio from "cheerio";

/**
 * Heading anchors for Insight (knowledge base) article bodies.
 *
 * CKEditor emits bare `<h2>`/`<h3>` tags, so a stored article has nothing a URL
 * fragment can target. {@link addHeadingIds} runs on every save and stamps an
 * `id` onto each heading, which is what makes
 * `/insight/<slug>#embedding-summative-assessments` land on the right section.
 *
 * IDs are written into storage rather than derived at render time for one
 * reason: an id already present is never recomputed. A shared link therefore
 * survives the author renaming the heading, which a render-time slug could not
 * do.
 *
 * NOTE: `client/src/utils/kbHeadings.ts` carries a copy of {@link slugifyHeading}
 * for content that has not been re-saved yet (and for the editor's preview).
 * The two must produce identical output — change them together.
 */

/** Longest generated id, before any de-duplication suffix. */
const MAX_SLUG_LENGTH = 80;

/**
 * Turns heading text into a URL fragment.
 *
 * Accents are decomposed and dropped so "Évaluation" and "Evaluation" agree,
 * and every run of non-alphanumerics collapses to a single hyphen. A result
 * that is empty or starts with a digit gets a `section-` prefix: a leading
 * digit is a valid HTML id but needs escaping in `querySelector`, and nothing
 * downstream should have to remember that.
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, ""); // the slice may have cut mid-word

  if (!slug || /^[0-9]/.test(slug)) return `section-${slug || "1"}`;
  return slug;
}

/**
 * Returns `html` with every heading carrying a unique `id`.
 *
 * Headings that already have one keep it — that is what makes the function
 * idempotent and what preserves anchors across heading renames. Generated ids
 * are de-duplicated within the document with `-2`, `-3`, … suffixes, checked
 * against ids already in use so a generated slug can never collide with an
 * author-written one.
 *
 * Parses in fragment mode, so cheerio does not wrap the body in `<html>` /
 * `<body>` on the way out.
 */
export function addHeadingIds(html: string): string {
  if (!html) return html;

  const $ = cheerio.load(html, null, false);
  const headings = $("h1, h2, h3, h4, h5, h6");
  if (headings.length === 0) return html;

  // Seed with the ids already in the document (headings and anything else), so
  // a slug we generate cannot land on one of them.
  const used = new Set<string>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (id) used.add(id);
  });

  headings.each((_, el) => {
    const heading = $(el);
    if (heading.attr("id")) return; // author's or a previous save's — leave it

    const base = slugifyHeading(heading.text());
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }

    used.add(id);
    heading.attr("id", id);
  });

  return $.html();
}
