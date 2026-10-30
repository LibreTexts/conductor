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
  /** The book's main page, whose subpages are the whole book. */
  isMainPage?: boolean;
};

/**
 * Every row of the table: the book's main page first, then its pages in TOC order beneath it.
 * The main page is edited like any page; its book-level credits are separate (`bookCredits`).
 */
export function bookRows(
  toc: TableOfContents | undefined,
  entries: Map<string, AuthorshipEntry>,
): AuthorshipRow[] {
  if (!toc) return [];
  return [
    { id: toc.id, title: toc.title, url: toc.url, depth: 0, entry: entries.get(toc.id), isMainPage: true },
    ...flattenToc(toc.children ?? [], entries, 1),
  ];
}

/** Pages in TOC order, each with its depth and credit data. */
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

/** One role's book-level credits, from the main page's entry. */
export const bookCreditsFor = (entry: AuthorshipEntry | undefined, role: CreditRole) =>
  creditsFor(entry?.bookCredits, role);

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

// ── Quick Fix ────────────────────────────────────────────────────────────────

/** Where the Quick Fix takes a missing role's person from. */
export type QuickFixSource = "parent" | "book" | "parent-then-book";

export type QuickFixPerson = { key: string; name: string };

export type QuickFixItem = {
  pageID: string;
  title: string;
  role: CreditRole;
  person: QuickFixPerson;
  from: "parent" | "book";
};

export type QuickFixPlan = {
  items: QuickFixItem[];
  /** Per role: pages in scope missing that role. */
  missing: Record<string, number>;
  /** Per role: missing pages the chosen source had no one for. */
  unresolved: Record<string, number>;
};

/** A page's own `<role>@` credit that names an author record, if it has one. */
function linkedOwnCredit(entry: AuthorshipEntry | undefined, role: CreditRole) {
  const ref = creditsFor(entry?.pageCredits, role).find(
    (r) => r.tag === roleInfo(role).tag && r.author,
  );
  return ref?.author ? { key: ref.author.nameKey, name: ref.author.name } : undefined;
}

/**
 * Plans filling in roles that scanned pages are missing. "parent" takes the nearest ancestor's
 * attribution (the main page included), counting what this fix would give that ancestor;
 * "book" takes the book attribution picked for the role. Only author records can be written,
 * so an ancestor whose attribution is plain text stops the search: guessing past it could
 * credit the wrong person. `onlyIDs` limits which pages are changed; pages outside it still
 * pass their attribution down.
 */
export function planQuickFix(
  rows: AuthorshipRow[],
  roles: CreditRole[],
  source: QuickFixSource,
  bookPicks: Partial<Record<CreditRole, QuickFixPerson>>,
  onlyIDs?: Set<string>,
): QuickFixPlan {
  const items: QuickFixItem[] = [];
  const missing: Record<string, number> = {};
  const unresolved: Record<string, number> = {};
  for (const role of roles) {
    missing[role] = 0;
    unresolved[role] = 0;
  }

  // What each open ancestor passes down per role: a person, "blocked" (plain-text attribution)
  // or undefined (nothing yet).
  type Inherited = Partial<Record<CreditRole, QuickFixPerson | "blocked">>;
  const stack: { depth: number; passes: Inherited }[] = [];

  for (const row of rows) {
    while (stack.length && stack[stack.length - 1].depth >= row.depth) stack.pop();
    const fromParent = stack[stack.length - 1]?.passes ?? {};
    const passes: Inherited = {};

    for (const role of roles) {
      const entry = row.entry;
      const own = linkedOwnCredit(entry, role);
      const hasAny = creditsFor(entry?.pageCredits, role).length > 0;
      if (own) {
        passes[role] = own;
        continue;
      }
      if (hasAny) {
        passes[role] = "blocked";
        continue;
      }

      const inScope = !!entry && entry.status === "completed" && (!onlyIDs || onlyIDs.has(row.id));
      const inherited = fromParent[role];
      if (!inScope) {
        passes[role] = inherited;
        continue;
      }

      missing[role] += 1;
      const parentPerson = inherited && inherited !== "blocked" ? inherited : undefined;
      let person: QuickFixPerson | undefined;
      let from: QuickFixItem["from"] = "parent";
      if (source !== "book") person = parentPerson;
      // With a parent fallback, a plain-text parent stops it; "book" ignores parents entirely.
      if (!person && (source === "book" || (source === "parent-then-book" && inherited !== "blocked"))) {
        person = bookPicks[role];
        from = "book";
      }
      if (!person) {
        unresolved[role] += 1;
        passes[role] = inherited;
        continue;
      }
      items.push({ pageID: row.id, title: row.title, role, person, from });
      passes[role] = person;
    }

    stack.push({ depth: row.depth, passes });
  }

  return { items, missing, unresolved };
}
