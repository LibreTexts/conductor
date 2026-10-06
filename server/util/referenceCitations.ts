import { isValidCitationKey } from "./referenceSanitize.js";

/** A `\librecite{a, b}` call; group 1 is its comma-separated keys. */
const librecitePattern = () => /\\librecite\{([^}]+)\}/g;

/**
 * Unique citation keys cited with `\librecite{…}` in page content, in order of
 * first appearance. Page text is author-controlled, so malformed keys are
 * dropped rather than stored and served to the library script.
 */
export const extractCitationKeys = (content: string): string[] => {
  const keys = new Set<string>();
  for (const match of content.matchAll(librecitePattern())) {
    for (const part of match[1].split(",")) {
      const key = part.trim();
      if (key && isValidCitationKey(key)) keys.add(key);
    }
  }
  return [...keys];
};

/** Renames citation keys inside every `\librecite{…}` call, leaving other text as it is. */
export const rewriteCitationKeys = (
  html: string,
  renames: Record<string, string>,
): string => {
  if (Object.keys(renames).length === 0) return html;
  return html.replace(librecitePattern(), (_call, keys: string) => {
    const rewritten = keys
      .split(",")
      .map((part) => {
        const key = part.trim();
        return renames[key] ? part.replace(key, renames[key]) : part;
      })
      .join(",");
    return `\\librecite{${rewritten}}`;
  });
};

export type CitationCheck = {
  /** Keys cited on pages that match no reference in the book, with the citing pages. */
  missing: { key: string; pages: { pageID: string; title?: string }[] }[];
  /** References in the book that no page cites. */
  unused: { referenceID: string; citationKey: string; title?: string }[];
};

/**
 * Compares the citations Populate recorded on each page with the book's
 * current references. Keys are matched against the current list, not the
 * IDs stored at Populate time, so adding or removing a reference afterwards
 * shows up without running Populate again.
 *
 * `pageReferences` may repeat a page from older runs; its last entry wins.
 */
export const compareCitations = (
  pageReferences: {
    pageID: string;
    title?: string;
    references: { key: string }[];
  }[],
  entries: { referenceID: string; citationKey: string; title?: string }[],
): CitationCheck => {
  const latestByPage = new Map<string, (typeof pageReferences)[number]>();
  for (const page of pageReferences) latestByPage.set(page.pageID, page);

  const knownKeys = new Set(entries.map((entry) => entry.citationKey));
  const citedKeys = new Set<string>();
  const missing = new Map<string, { pageID: string; title?: string }[]>();
  for (const page of latestByPage.values()) {
    for (const { key } of page.references) {
      citedKeys.add(key);
      if (knownKeys.has(key)) continue;
      const pages = missing.get(key) ?? [];
      pages.push({ pageID: page.pageID, title: page.title });
      missing.set(key, pages);
    }
  }

  return {
    missing: [...missing].map(([key, pages]) => ({ key, pages })),
    unused: entries
      .filter((entry) => !citedKeys.has(entry.citationKey))
      .map(({ referenceID, citationKey, title }) => ({
        referenceID,
        citationKey,
        title,
      })),
  };
};

/** DOI or URL, normalized, used to tell that two references are the same work. */
export const workIdentity = (reference: {
  doi?: string;
  url?: string;
}): string | null => {
  const doi = reference.doi
    ?.trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "");
  if (doi) return `doi:${doi}`;
  const url = reference.url
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return url ? `url:${url}` : null;
};
