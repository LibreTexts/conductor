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

/** Every key a scan found cited, with the pages citing it. */
export type CitedKey = {
  key: string;
  pages: { pageID: string; title?: string }[];
};

/**
 * Each cited key with the pages that cite it, from a scan's per-page results.
 * `pageReferences` may repeat a page from older runs; its last entry wins.
 */
export const collectCitations = (
  pageReferences: {
    pageID: string;
    title?: string;
    references: { key: string }[];
  }[],
): CitedKey[] => {
  const latestByPage = new Map<string, (typeof pageReferences)[number]>();
  for (const page of pageReferences) latestByPage.set(page.pageID, page);

  const pagesByKey = new Map<string, { pageID: string; title?: string }[]>();
  for (const page of latestByPage.values()) {
    for (const { key } of page.references) {
      const pages = pagesByKey.get(key) ?? [];
      pages.push({ pageID: page.pageID, title: page.title });
      pagesByKey.set(key, pages);
    }
  }
  return [...pagesByKey].map(([key, pages]) => ({ key, pages }));
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
