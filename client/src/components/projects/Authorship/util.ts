import type {
  AuthorshipAuthorRef,
  AuthorshipEntry,
  CreditRole,
  TableOfContents,
} from "../../../types";

/** The credit roles, in display order. `tag` is what gets written: `<tag><authorKey>`. */
export const CREDIT_ROLES: { key: CreditRole; label: string; tag: string }[] = [
  { key: "author", label: "Author", tag: "author@" },
  { key: "editor", label: "Editor", tag: "editor@" },
  { key: "remixer", label: "Remixer", tag: "remixer@" },
  { key: "translator", label: "Translator", tag: "translator@" },
  { key: "contributor", label: "Contributor", tag: "contributor@" },
  { key: "illustrator", label: "Illustrator", tag: "illustrator@" },
  { key: "reviewedBy", label: "Reviewer", tag: "reviewedBy@" },
];

export const roleInfo = (role: CreditRole) =>
  CREDIT_ROLES.find((r) => r.key === role) ?? CREDIT_ROLES[0];

export type AuthorshipRow = {
  id: string;
  title: string;
  url: string;
  depth: number;
  entry?: AuthorshipEntry;
};

/** The book's pages in TOC order (cover excluded), each with its depth and credit data. */
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

/** One role's refs from one of an entry's credit lists. */
export function creditsFor(refs: AuthorshipAuthorRef[] | undefined, role: CreditRole) {
  return (refs ?? []).filter((r) => r.role === role);
}

/** The page's own `<role>@` tags (not the older `authorname:` fallback). */
const ownRoleTags = (entry: AuthorshipEntry | undefined, role: CreditRole) =>
  creditsFor(entry?.pageCredits, role).filter((r) => r.tag === roleInfo(role).tag);

/** The `<role>@` key a page carries, when it has exactly one (as the tool writes it). */
export function currentKey(entry: AuthorshipEntry | undefined, role: CreditRole): string | null {
  const own = ownRoleTags(entry, role);
  return own.length === 1 ? own[0].value : null;
}

/** True when writing `authorKey` (or clearing, with null) for this role would change nothing. */
export function isUnchanged(
  entry: AuthorshipEntry | undefined,
  role: CreditRole,
  authorKey: string | null,
): boolean {
  const own = ownRoleTags(entry, role);
  return authorKey === null ? own.length === 0 : own.length === 1 && own[0].value === authorKey;
}

/**
 * A scanned page that credits no author of its own. Only the author role is required, and a
 * book author doesn't count for the page. Pages not scanned yet aren't flagged.
 */
export function isMissingAuthor(entry: AuthorshipEntry | undefined): boolean {
  return !!entry && entry.status === "completed" && creditsFor(entry.pageCredits, "author").length === 0;
}

/**
 * The URL to link to, only when it is http(s). Author URLs are stored data rendered as links, so
 * anything else (javascript:, data:, …) is shown as plain text instead.
 */
export function safeHref(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** What to show for a credit tag: the resolved author's name, or the tag text as written. */
export function authorRefLabel(ref: AuthorshipAuthorRef): string {
  return ref.author?.name ?? ref.value;
}
