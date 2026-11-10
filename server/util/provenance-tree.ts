import { many } from "@libretexts/cxone-expert-node";
import CXOnePageProperties from "./CXOne/CXOnePageProperties.js";
import { REUSE_EDGE_TYPES, type ReuseEdgeType } from "./provenance-graph.js";

/**
 * Turns a MindTouch `pages/{id}/tree?include=properties,lastmodified`
 * response into flat per-page records for the provenance scanner. Pure, so
 * the response shape can be tested without a library.
 *
 * One tree request carries everything the scanner needs to decide whether a
 * page changed and how it is organized: id, parent, path, title, revision,
 * modified date, and every page property (article type and Conductor's source
 * property included). Only changed pages then cost a content request.
 */

/** Lineage written onto a copied page by Remixer (see provenance-capture-service). */
export type ConductorSourceProperty = {
  /** PageNode id of the page the copy was made from. */
  source: string;
  type: Extract<ReuseEdgeType, "fork" | "full">;
  revision?: number;
};

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
  conductorSource: ConductorSourceProperty | null;
};

const ARTICLE_TYPE_PROPERTY = CXOnePageProperties.ArticleType;
const CONDUCTOR_SOURCE_PROPERTY = CXOnePageProperties.ConductorSource;
const NODE_ID_RE = /^[a-z0-9]+-\d+$/i;

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

/**
 * Parses the Conductor source property. Returns null for anything that is
 * not a well-formed record, so a hand-edited or foreign value is ignored
 * rather than turned into a bogus edge.
 */
export const parseConductorSource = (
  raw: string | undefined,
): ConductorSourceProperty | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const source = typeof parsed?.source === "string" ? parsed.source : "";
    const type = parsed?.type;
    if (!NODE_ID_RE.test(source)) return null;
    if (type !== "fork" && type !== "full") return null;
    if (!REUSE_EDGE_TYPES.includes(type)) return null;
    const revision = toInt(parsed.revision);
    return { source, type, ...(revision !== undefined ? { revision } : {}) };
  } catch {
    return null;
  }
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

  const walk = (page: any, parentID: number | null, isCover: boolean) => {
    const pageID = toInt(page?.["@id"]);
    if (pageID === undefined || seen.has(pageID)) return;
    seen.add(pageID);

    const props = readProperties(page);
    pages.push({
      pageID,
      parentID,
      path: text(page?.path),
      title: text(page?.title),
      revision: toInt(page?.["@revision"]),
      modifiedAt: toDate(page?.["date.modified"]),
      articleType: props.get(ARTICLE_TYPE_PROPERTY)?.trim() || undefined,
      isCover,
      conductorSource: parseConductorSource(props.get(CONDUCTOR_SOURCE_PROPERTY)),
    });

    for (const child of many<any>(page?.subpages?.page)) {
      walk(child, pageID, false);
    }
  };

  if (root) walk(root, null, true);
  return pages;
};

/** Pseudo-tags the content classifier understands, from tree metadata. */
export const structuralTagsFor = (page: TreePageInfo): string[] => {
  const tags: string[] = [];
  if (page.isCover) tags.push("coverpage:yes");
  if (page.articleType) tags.push(`article:${page.articleType}`);
  return tags;
};
