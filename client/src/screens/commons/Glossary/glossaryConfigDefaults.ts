import { TableOfContents } from "../../../types/Book";
import { getPageAncestors } from "./services";
import { GlossaryConfigGroup, GlossaryConfigMode } from "./model";

/**
 * Returns a node's id plus the ids of every descendant, depth-first.
 */
export function collectSubtreeIds(node: TableOfContents): string[] {
  const ids: string[] = [node.id];
  for (const child of node.children) {
    ids.push(...collectSubtreeIds(child));
  }
  return ids;
}

/**
 * Returns the id of the top-level TOC node ("chapter") that `pageId` lives
 * under — the first ancestor below the root. Falls back to the root's own
 * id when `pageId` has no ancestors (it IS the root, or wasn't found).
 */
export function getTopLevelAncestorId(
  toc: TableOfContents,
  pageId: string,
): string {
  const ancestors = getPageAncestors(toc, pageId);
  if (ancestors.length === 0) {
    return toc.id;
  }
  return ancestors[0];
}

const newGroupID = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * The book root (the cover/book-level TOC node) is never treated as a
 * content page — it isn't a real page with its own glossary terms, so it's
 * excluded from every mode's default generation. `toc.children` (the actual
 * top-level chapters) is always the starting point instead of `toc` itself.
 */

/**
 * Picks a sensible fallback target page when neither an explicit choice nor
 * an existing "Glossary" page is available: the book's first top-level
 * chapter, or — for a book with no chapters at all — the root itself, since
 * there is nothing else to point at.
 */
export function fallbackTargetPageId(toc: TableOfContents): string {
  return toc.children[0]?.id ?? toc.id;
}

/**
 * Generates the default group set for a glossary mode. Pure and
 * deterministic aside from group IDs — never persists anything.
 *
 * `glossaryPageId` is the book's existing back-matter "Glossary" page, if
 * one has been located — BACKEND mode's single group always targets it
 * (falling back to the book's first chapter when the book has no such page
 * yet).
 */
export function generateDefaultGroups(
  mode: GlossaryConfigMode,
  toc: TableOfContents,
  glossaryPageId?: string,
): GlossaryConfigGroup[] {
  switch (mode) {
    case "PAGE":
      return generatePageGroups(toc);
    case "CHAPTER":
      return generateChapterGroups(toc);
    case "BACKEND":
      return [
        {
          groupID: newGroupID(),
          pageIds: toc.children.flatMap(collectSubtreeIds),
          targetPageId: glossaryPageId ?? fallbackTargetPageId(toc),
        },
      ];
    default:
      return [];
  }
}

/**
 * One group per TOC node (excluding the book root), each containing just
 * that page and displaying on that same page — scenario 1 needs no target
 * choice, it's always itself.
 */
function generatePageGroups(toc: TableOfContents): GlossaryConfigGroup[] {
  const groups: GlossaryConfigGroup[] = [];
  const visit = (node: TableOfContents) => {
    groups.push({
      groupID: newGroupID(),
      pageIds: [node.id],
      targetPageId: node.id,
    });
    node.children.forEach(visit);
  };
  toc.children.forEach(visit);
  return groups;
}

/**
 * One group per top-level chapter, each containing the chapter page and
 * every page nested under it, defaulting to display on the chapter page
 * itself (the user can point it at any page instead, and can merge
 * multiple chapters into one group by dragging one chapter's pages into
 * another's). A book with no top-level chapters yields no groups.
 */
function generateChapterGroups(toc: TableOfContents): GlossaryConfigGroup[] {
  return toc.children.map((chapter) => ({
    groupID: newGroupID(),
    pageIds: collectSubtreeIds(chapter),
    targetPageId: chapter.id,
  }));
}

export type DropTarget =
  | { type: "group"; groupIndex: number }
  | { type: "unassigned" };

/**
 * Applies a drag-and-drop result: removes every id in `pageIds` from every
 * group, then — unless the drop target is the "unassigned" bucket — adds
 * them all to the target group, in the order given. Pure, so it doesn't
 * matter whether the pages were dragged from a single chip, the unassigned
 * list, or a whole chapter's subtree in the TOC; the outcome is the same.
 * A no-op (same reference back) when every id is already in the target
 * group, so dropping a chapter back onto its own group doesn't reorder it.
 */
export function resolveDrop(
  groups: GlossaryConfigGroup[],
  pageIds: string[],
  target: DropTarget,
): GlossaryConfigGroup[] {
  if (pageIds.length === 0) return groups;

  if (
    target.type === "group" &&
    pageIds.every((id) => groups[target.groupIndex]?.pageIds.includes(id))
  ) {
    return groups;
  }

  const idSet = new Set(pageIds);
  const withoutPages = groups.map((g) => ({
    ...g,
    pageIds: g.pageIds.filter((id) => !idSet.has(id)),
  }));
  if (target.type === "unassigned") {
    return withoutPages;
  }
  return withoutPages.map((g, i) =>
    i === target.groupIndex ? { ...g, pageIds: [...g.pageIds, ...pageIds] } : g,
  );
}
