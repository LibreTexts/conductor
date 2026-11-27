import { many } from "@libretexts/cxone-expert-node";
import CXOnePageProperties from "./CXOne/CXOnePageProperties.js";

/**
 * Turns a MindTouch `pages/{id}/tree?include=properties,lastmodified`
 * response into flat per-page records for the provenance scanner. Pure, so
 * the response shape can be tested without a library.
 *
 * One tree request carries everything the scanner needs to decide whether a
 * page changed and how it is organized: id, parent, path, title, revision,
 * modified date, and MindTouch's own article-type property. It is read only:
 * provenance never writes tags or properties to a library. Only changed
 * pages then cost a content request.
 */

export type TreePageInfo = {
  pageID: number;
  parentID: number | null;
  path?: string;
  title?: string;
  revision?: number;
  modifiedAt?: Date;
  /** `mindtouch.page#articleType`, e.g. "topic-category". */
  articleType?: string;
  /** The book's own cover page (root of the tree). */
  isCover: boolean;
  /**
   * A Front/Back Matter container or one of the standard pages the LibreTexts
   * batch service generates into it (TitlePage, Index, …). These are the same
   * in every book, so they are neither authored content nor reuse.
   */
  isGeneratedMatter: boolean;
};

/**
 * Titles of the pages the batch service generates into a matter container.
 * Mirrors `matterNodeValidTitles` in client/src/components/remixer/model.ts.
 */
const GENERATED_MATTER_TITLES = new Set(
  [
    "TitlePage",
    "InfoPage",
    "Table of Contents",
    "Licensing",
    "Index",
    "Glossary",
    "Detailed Licensing",
  ].map((t) => t.toLowerCase()),
);

/** `00:_Front_Matter` / `0:_Front_Matter` / `zz:_Back_Matter` path segments. */
const MATTER_CONTAINER_SEGMENT_RE = /^(?:0{1,2}:_?Front_Matter|zz:_?Back_Matter)$/i;

/** Drops a numbering prefix such as `1: `, `00.01: ` or `3.2 - `. */
const stripNumbering = (title: string): string =>
  title.replace(/^\s*\d+(?:\.\d+)*\s*[:.\-]\s*/, "").trim();

/**
 * Front/Back Matter container, recognized at any depth the way the remixer
 * UI does (by path segment or title), not only as a child of the cover:
 * matter nested under a wrapper chapter is still generated matter.
 */
const isMatterContainer = (title: string | undefined, path: string | undefined): boolean => {
  const leaf = (path ?? "").split("/").pop() ?? "";
  if (MATTER_CONTAINER_SEGMENT_RE.test(leaf)) return true;
  const name = stripNumbering(title ?? "").toLowerCase();
  return name === "front matter" || name === "back matter";
};

const ARTICLE_TYPE_PROPERTY = CXOnePageProperties.ArticleType;

const toInt = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** A text value that may come as a string or as `{ "#text": ... }`. */
const text = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  const inner = (value as { "#text"?: unknown } | null)?.["#text"];
  return typeof inner === "string" ? inner : undefined;
};

const readProperties = (page: any): Map<string, string | undefined> => {
  const props = new Map<string, string | undefined>();
  for (const prop of many<any>(page?.properties?.property)) {
    const name = prop?.["@name"];
    if (typeof name === "string") props.set(name, text(prop?.contents));
  }
  return props;
};

/** Every page in a tree response, cover first, parents before children. */
export const flattenPageTree = (root: any): TreePageInfo[] => {
  const pages: TreePageInfo[] = [];
  const seen = new Set<number>();

  const walk = (
    page: any,
    parentID: number | null,
    isCover: boolean,
    parentIsMatterContainer: boolean,
  ) => {
    const pageID = toInt(page?.["@id"]);
    if (pageID === undefined || seen.has(pageID)) return;
    seen.add(pageID);

    const props = readProperties(page);
    const title = text(page?.title);
    const path = text(page?.path);
    const isContainer = !isCover && isMatterContainer(title, path);
    const isDefaultMatterPage =
      parentIsMatterContainer &&
      GENERATED_MATTER_TITLES.has(stripNumbering(title ?? "").toLowerCase());

    pages.push({
      pageID,
      parentID,
      path,
      title,
      revision: toInt(page?.["@revision"]),
      modifiedAt: toDate(page?.["date.modified"]),
      articleType: props.get(ARTICLE_TYPE_PROPERTY)?.trim() || undefined,
      isCover,
      isGeneratedMatter: isContainer || isDefaultMatterPage,
    });

    for (const child of many<any>(page?.subpages?.page)) {
      walk(child, pageID, false, isContainer);
    }
  };

  if (root) walk(root, null, true, false);
  return pages;
};

/** Pseudo-tags the content classifier understands, from tree metadata. */
export const structuralTagsFor = (page: TreePageInfo): string[] => {
  const tags: string[] = [];
  if (page.isCover) tags.push("coverpage:yes");
  if (page.articleType) tags.push(`article:${page.articleType}`);
  return tags;
};
