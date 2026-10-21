import type { AuthorshipAuthorRef, AuthorshipEntry, TableOfContents } from "../../../types";

export type AuthorshipRow = {
  id: string;
  title: string;
  url: string;
  depth: number;
  entry?: AuthorshipEntry;
};

/** The book's pages in TOC order (cover excluded), each with its depth and authorship data. */
export function flattenToc(
  nodes: TableOfContents[],
  entries: Map<string, AuthorshipEntry>,
  depth = 0,
): AuthorshipRow[] {
  return nodes.flatMap((node) => [
    { id: node.id, title: node.title, url: node.url, depth, entry: entries.get(node.id) },
    ...flattenToc(node.children ?? [], entries, depth + 1),
  ]);
}

/** The `author@` key a page carries, when it has exactly one (as the Authorship tool writes it). */
export function currentAuthorKey(entry?: AuthorshipEntry): string | null {
  const own = (entry?.pageAuthors ?? []).filter((r) => r.tag === "author@");
  return own.length === 1 ? own[0].value : null;
}

/** True when writing `authorKey` (or clearing, with null) would leave the page as it is. */
export function isUnchanged(entry: AuthorshipEntry | undefined, authorKey: string | null): boolean {
  const own = (entry?.pageAuthors ?? []).filter((r) => r.tag === "author@");
  return authorKey === null ? own.length === 0 : own.length === 1 && own[0].value === authorKey;
}

/** What to show for an author tag: the resolved author's name, or the tag text as written. */
export function authorRefLabel(ref: AuthorshipAuthorRef): string {
  return ref.author?.name ?? ref.value;
}
