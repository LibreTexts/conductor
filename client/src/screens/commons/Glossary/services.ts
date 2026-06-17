import { TableOfContents } from "../../../types/Book";

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