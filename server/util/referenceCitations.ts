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
