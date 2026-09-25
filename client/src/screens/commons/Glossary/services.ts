import axios from "axios";
import { TableOfContents } from "../../../types/Book";
import { GlossaryEntry } from "./model";

/** Most terms one bulk delete may remove; the server enforces the same limit. */
export const MAX_BULK_DELETE_TERMS = 200;

/** Prefers the server's `errMsg` from an axios error, then the error's own message. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { errMsg?: string } | undefined;
    if (data?.errMsg) return data.errMsg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/**
 * Finds a TOC node by id, searching the root and all nested children.
 */
export const findTocNodeById = (
  root: TableOfContents,
  id: string,
): TableOfContents | undefined => {
  if (root.id === id) {
    return root;
  }

  for (const child of root.children) {
    const found = findTocNodeById(child, id);
    if (found) {
      return found;
    }
  }

  return undefined;
};

/**
 * Depth-first search for the first TOC node matching a predicate.
 */
export const findTocNode = (
  root: TableOfContents,
  predicate: (node: TableOfContents) => boolean,
): TableOfContents | undefined => {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const found = findTocNode(child, predicate);
    if (found) return found;
  }
  return undefined;
};

/**
 * Extracts the LibreTexts library subdomain from a page URL (e.g. "chem" from chem.libretexts.org).
 */
export const extractLibraryFromURL = (url: string): string | undefined => {  if (!url) return undefined;

  try {
    const { hostname } = new URL(url);
    const match = hostname.match(/^([a-z0-9-]+)\.libretexts\.org$/i);
    return match?.[1]?.toLowerCase();
  } catch {
    return undefined;
  }
};

/**
 * Returns the IDs of the node itself and all its ancestors in the TOC tree,
 * from root down to the target node. Returns an empty array if not found.
 */
const _findPath = (node: TableOfContents, nodeId: string): string[] => {
  if (node.id === nodeId) return [node.id];
  for (const child of node.children) {
    const path = _findPath(child, nodeId);
    if (path.length > 0) return [node.id, ...path];
  }
  return [];
};

/**
 * Returns the IDs of the node itself and all its ancestors in the TOC tree,
 * from root down to the target node, excluding the root node itself.
 * Returns an empty array if not found.
 */
export const getPageAncestors = (toc: TableOfContents, nodeId: string): string[] => {
  return _findPath(toc, nodeId).slice(1);
}

/**
 * Entries with at least one usage on the given page — used to scope a CSV
 * dump to a single TOC node rather than the whole book.
 */
export const filterGlossaryEntriesForPage = (
  entries: GlossaryEntry[],
  pageId: string,
): GlossaryEntry[] =>
  entries.filter((entry) => entry.pages.some((page) => page.pageID === pageId));

/**
 * LaTeX segments MathJax renders (see utils/mathjax.ts): `\( \)`, `\[ \]`,
 * `$$ $$`, and `\begin{…} … \end{…}` environments. Captured so they can be
 * exported verbatim.
 */
const MATH_SEGMENT =
  /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\begin\{([^}]+)\}[\s\S]*?\\end\{\2\})/g;

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");

/**
 * Definitions can carry HTML; a CSV cell wants plain text. Tags are stripped
 * only outside math, so LaTeX such as `\(a<b\)` is exported as written
 * rather than having `<b … >` mistaken for a tag.
 */
export const stripHtml = (value: string): string => {
  const parts = value.split(MATH_SEGMENT);
  let out = "";
  // split() with capture groups yields [text, math, envName, text, …].
  for (let i = 0; i < parts.length; i += 3) {
    out += decodeEntities((parts[i] ?? "").replace(/<[^>]*>/g, " "));
    if (parts[i + 1] !== undefined) out += decodeEntities(parts[i + 1]);
  }
  return out.replace(/\s+/g, " ").trim();
};

/**
 * Spreadsheet apps run a cell starting with one of these as a formula
 * (CSV/formula injection). LaTeX (`\(`, `\[`, `$$`) never starts with them.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Prefixes a leading `'` on cells a spreadsheet would treat as a formula, so
 * they open as text. The CSV import strips that prefix again on round-trip.
 */
export const neutralizeCsvFormula = (value: string): string =>
  FORMULA_TRIGGER.test(value) ? `'${value}` : value;

/** Quotes a CSV field only when it contains characters that require it. */
const escapeCsvField = (value: string): string => {
  const safe = neutralizeCsvFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const GLOSSARY_CSV_HEADER = [
  "Term",
  "Definition",
  "Aliases",
  "Author",
  "Source",
  "Link",
  "Page IDs",
];

/** Serializes glossary entries to CSV — one row per term, in table order. */
export const glossaryEntriesToCsv = (entries: GlossaryEntry[]): string => {
  const rows = entries.map((entry) => [
    entry.term,
    stripHtml(entry.definition ?? ""),
    (entry.aliases ?? []).join("; "),
    entry.author ?? "",
    entry.source ?? "",
    entry.link ?? "",
    entry.pages.map((page) => page.pageID).join("; "),
  ]);
  return [GLOSSARY_CSV_HEADER, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
};

/** Triggers a browser download of `content` as a file named `filename`. */
export const downloadCsv = (filename: string, content: string): void => {
  // Leading BOM so Excel opens the UTF-8 file without mangling accented characters.
  const blob = new Blob(["﻿" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Sort key for a glossary term that ignores punctuation/symbols (quotes,
 * commas, hyphens, etc.) and a leading English direct/indirect article
 * ("the", "a", "an") — e.g. `"The Apple,"` sorts under "A", not `"` or "T".
 * Mirrors `alphabetizationKey` in server/api/services/glossary-service.ts;
 * used so the admin table's own column-header sort (react-table's default
 * string compare on the raw term) agrees with the server's default order
 * instead of putting a quoted/punctuated term first.
 */
export const alphabetizationKey = (term: string): string => {
  const normalized = term
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.replace(/^(the|an?)\s+/, "");
};

/** Filesystem-safe-ish filename slug from a book/page title. */
export const slugifyForFilename = (title: string): string =>
  title
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "glossary";

/**
 * react-hook-form validator for an optional glossary link. The link ends up
 * in an `href`, so only absolute http(s) URLs pass — `new URL()` alone would
 * accept `javascript:` URLs. Mirrors glossaryLinkSchema on the server.
 */
export function validateOptionalHttpUrl(value?: string): true | string {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  try {
    const { protocol } = new URL(trimmed);
    if (protocol === "http:" || protocol === "https:") return true;
  } catch {
    // fall through
  }
  return "Please enter a valid http:// or https:// URL";
}
