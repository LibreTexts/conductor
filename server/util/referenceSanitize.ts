/**
 * Reference data is rendered on public library pages by the biblizer script,
 * which inserts formatted citations with innerHTML. Anything a project member
 * stores in a reference must therefore be inert: no markup, no script URLs,
 * and citation keys safe to use as `\librecite{}` keys and HTML ids.
 */

import { isHttpUrl, sanitizeLibraryText } from "./sanitize-text.js";

/** BibTeX-style keys: no spaces, commas, braces, quotes or angle brackets. */
export const CITATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-:.+/]{0,99}$/;

export const CITATION_KEY_RULE =
  "Citation keys can use letters, numbers and _ - : . + / (no spaces), up to 100 characters, starting with a letter or number";

export const isValidCitationKey = (key: string): boolean =>
  CITATION_KEY_PATTERN.test(key);

/** Longest value kept per free-text field; the rest are capped at 300. */
const FIELD_MAX_LENGTH: Record<string, number> = {
  title: 1000,
  booktitle: 1000,
  journal: 500,
  author: 2000,
  editor: 2000,
  note: 2000,
  publisher: 500,
  address: 500,
  school: 500,
};
const DEFAULT_FIELD_MAX_LENGTH = 300;

export const maxLengthFor = (field: string): number =>
  FIELD_MAX_LENGTH[field] ?? DEFAULT_FIELD_MAX_LENGTH;

/**
 * Plain, inert text. Markup, entities, control/format characters and
 * whitespace are handled by the shared `sanitizeLibraryText` (real HTML
 * parser, decoded until stable). On top of that, references are inserted by
 * the biblizer with innerHTML, so any `<`/`>` that survives as literal text is
 * swapped for a look-alike: "p < 0.05" still reads the same but can never
 * open a tag.
 */
export const sanitizeReferenceText = (value: string, maxLength = 2000): string =>
  sanitizeLibraryText(value)
    .replace(/</g, "＜")
    .replace(/>/g, "＞")
    .slice(0, maxLength);

/** An absolute http(s) URL, or null. Rejects `javascript:`, `data:` and the like. */
export const normalizeHttpUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return isHttpUrl(trimmed) ? new URL(trimmed).toString() : null;
};

const DOI_PATTERN = /^10\.\d{4,9}\/[^\s<>"'`{}]+$/;

/** A bare DOI (`10.1000/xyz`), with any doi.org URL or `doi:` prefix removed, or null. */
export const normalizeDoi = (value: string): string | null => {
  const bare = value
    .trim()
    .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!bare) return "";
  return DOI_PATTERN.test(bare) ? bare : null;
};

/**
 * Cleans one stored field value for output or copying. Invalid URLs and DOIs
 * are dropped rather than passed on; everything else becomes inert text.
 */
export const sanitizeReferenceField = (field: string, value: string): string => {
  if (field === "url") return normalizeHttpUrl(value) ?? "";
  if (field === "doi") return normalizeDoi(value) ?? "";
  return sanitizeReferenceText(value, maxLengthFor(field));
};
