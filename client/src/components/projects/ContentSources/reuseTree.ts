import type {
  ContentSourcesPage,
  ReuseEdgeStatus,
  ReuseEdgeType,
} from "../../../types/ContentSources";

/**
 * The book's own tree, pruned to where it reuses content: this book → the
 * chapters, sub-chapters and pages on the way to each page that reuses
 * something → that page's sources. Siblings that lead to no reuse are left
 * out at every level. Pure, for `BookReuseTree` to draw with d3.
 */

export type ReuseTreeDatum = {
  key: string;
  /** `book`: this book (the root); `page`: one of its pages; `source`: a page it reuses. */
  kind: "book" | "page" | "source";
  label: string;
  /** A page of this book that reuses content itself (not just a chapter on the way). */
  reuses?: boolean;
  /** For a source: how it's reused, its library, and the link's status. */
  type?: ReuseEdgeType;
  lib?: string | null;
  status?: ReuseEdgeStatus;
  children?: ReuseTreeDatum[];
};

export type ReuseTree = {
  root: ReuseTreeDatum;
  /** Pages of the book that reuse content. */
  reusedPages: number;
  /** Of those, the ones drawn; the rest are past the cap. */
  shownPages: number;
  hiddenPages: number;
  /** Distinct source pages of the drawn pages. */
  sources: number;
  /** Top-level chapters drawn. */
  chapters: number;
  /** All pages in the book, cover included (as the summary counts them). */
  totalPages: number;
};

/** Reused pages drawn before the rest become "and N more pages". */
export const MAX_REUSED_PAGES = 40;

type Node = { page: ContentSourcesPage; children: Node[] };

/**
 * Builds the pruned tree from the pages payload, which lists the book in
 * table-of-contents order with each page's depth (0 = cover): a page's parent
 * is the nearest earlier page one level up.
 */
export const buildReuseTree = (
  pages: ContentSourcesPage[],
  bookTitle: string,
  { maxPages = MAX_REUSED_PAGES }: { maxPages?: number } = {},
): ReuseTree => {
  const top: Node[] = [];
  const stack: Node[] = [];
  for (const page of pages) {
    if (page.depth <= 0) continue; // The cover is the root.
    const node: Node = { page, children: [] };
    while (stack.length && stack[stack.length - 1].page.depth >= page.depth) stack.pop();
    (stack.length ? stack[stack.length - 1].children : top).push(node);
    stack.push(node);
  }

  // The first `maxPages` reusing pages in reading order are drawn.
  const reusing = pages.filter((p) => p.depth > 0 && p.sources.length > 0);
  const shown = new Set(reusing.slice(0, maxPages).map((p) => p.id));
  const sourceIDs = new Set<string>();

  const prune = (node: Node): ReuseTreeDatum | null => {
    const children = node.children.map(prune).filter((c): c is ReuseTreeDatum => c !== null);
    const reuses = shown.has(node.page.id);
    if (!reuses && children.length === 0) return null;
    const sources: ReuseTreeDatum[] = reuses
      ? node.page.sources.map((s) => {
          sourceIDs.add(s.id);
          return {
            key: `${node.page.id}<${s.id}`,
            kind: "source",
            label: s.title,
            type: s.type,
            lib: s.lib,
            status: s.status,
          };
        })
      : [];
    return {
      key: node.page.id,
      kind: "page",
      label: node.page.title,
      reuses,
      // Its own sources first, then the sub-pages that lead to more reuse.
      children: [...sources, ...children],
    };
  };

  const chapters = top.map(prune).filter((c): c is ReuseTreeDatum => c !== null);
  return {
    root: { key: "book", kind: "book", label: bookTitle, children: chapters },
    reusedPages: reusing.length,
    shownPages: shown.size,
    hiddenPages: reusing.length - shown.size,
    sources: sourceIDs.size,
    chapters: chapters.length,
    totalPages: pages.length,
  };
};
