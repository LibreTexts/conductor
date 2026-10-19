/**
 * Helpers for reading and rewriting a CXOne (MindTouch) page's tags.
 *
 * CXOne has no "add a tag" or "delete a tag" endpoint: `PUT /pages/{id}/tags`
 * replaces the page's entire tag set. Every write is therefore a
 * read-modify-write — `getPageTags`, edit the list, PUT the whole list back —
 * and a tag that could not be read cleanly must abort the write rather than be
 * silently dropped. {@link readTagValues} reports unreadable entries instead of
 * discarding them so callers can make that refusal.
 */

import type { PageTag, Tags } from "@libretexts/cxone-expert-node";

/** CXOne returns repeated elements as object | array | "" depending on cardinality. */
export function toArray<T>(value: T | T[] | "" | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Tag values from a `GET /pages/{id}/tags` response, in the order returned.
 *
 * Because `PUT /pages/{id}/tags` replaces the whole set, a tag we fail to read
 * is a tag we would silently delete. Anything without a usable `@value` is
 * therefore reported instead of dropped, and the caller aborts the page.
 */
export function readTagValues(tags: Partial<Tags> | undefined): {
  values: string[];
  unreadable: number;
} {
  const entries = toArray<Partial<PageTag> | "">(tags?.tag);
  const values: string[] = [];
  let unreadable = 0;

  for (const entry of entries) {
    const value = entry ? entry["@value"] : undefined;
    if (typeof value === "string" && value.length) {
      if (!values.includes(value)) values.push(value);
    } else {
      unreadable++;
    }
  }

  return { values, unreadable };
}

/**
 * Escapes a tag value for use inside a double-quoted XML attribute. `&` must go
 * first so the ampersands introduced by the later replacements are not escaped
 * a second time. `'` needs no escaping inside double quotes.
 */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the `<tags><tag value="..." /></tags>` document CXOne expects, sent as
 * `application/xml`. An empty list yields `<tags />`, which clears the page's
 * tags.
 */
export function buildTagsPayload(values: string[]): string {
  if (!values.length) return "<tags />";
  const tags = values
    .map((value) => `<tag value="${escapeXmlAttr(value)}" />`)
    .join("");
  return `<tags>${tags}</tags>`;
}
