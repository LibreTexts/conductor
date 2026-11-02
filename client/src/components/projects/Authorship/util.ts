import type {
  AuthorshipAuthor,
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

/**
 * How a change treats a role's existing people: replace them all ("set"; a null key clears the
 * role), add one, or remove one tag value. Mirrors the server.
 */
export type RoleAction = "set" | "add" | "remove";

export type RoleChange = { role: CreditRole; action: RoleAction; authorKey: string | null };

/** True when applying the change to the page would change nothing. */
export function isUnchanged(entry: AuthorshipEntry | undefined, change: RoleChange): boolean {
  const values = ownRoleTags(entry, change.role).map((r) => r.value);
  const { action, authorKey } = change;
  if (action === "set") {
    return authorKey === null ? values.length === 0 : values.length === 1 && values[0] === authorKey;
  }
  if (!authorKey) return true;
  return action === "add" ? values.includes(authorKey) : !values.includes(authorKey);
}

/**
 * A page's credits after the change, as the server stores them: only the role's `<role>@` tags
 * change. The older `authorname:` author tag is only shown while the page has no `author@` tag,
 * so it reappears when the last one is removed. `author` is the record added or set, if any.
 */
export function applyChangeToCredits(
  credits: AuthorshipAuthorRef[],
  change: RoleChange,
  author?: AuthorshipAuthor,
): AuthorshipAuthorRef[] {
  const { role, action, authorKey } = change;
  const tag = roleInfo(role).tag;
  const isOwn = (r: AuthorshipAuthorRef) => r.role === role && r.tag === tag;
  const own = credits.filter(isOwn);
  const fallback = credits.filter((r) => r.role === role && r.tag !== tag);
  const others = credits.filter((r) => r.role !== role);

  let nextOwn = own;
  if (action === "set") nextOwn = authorKey ? [{ role, tag, value: authorKey, author }] : [];
  else if (action === "add" && authorKey && !own.some((r) => r.value === authorKey)) {
    nextOwn = [...own, { role, tag, value: authorKey, author }];
  } else if (action === "remove") nextOwn = own.filter((r) => r.value !== authorKey);

  return [...others, ...(nextOwn.length ? nextOwn : fallback)];
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

/** Where the Quick Fix takes a missing role's people from. */
export type QuickFixSource = "parent" | "book" | "parent-then-book";

export type QuickFixPerson = { key: string; name: string };

export type QuickFixItem = {
  pageID: string;
  title: string;
  role: CreditRole;
  people: QuickFixPerson[];
  from: "parent" | "book";
};

export type QuickFixPlan = {
  items: QuickFixItem[];
  /** Per role: pages in scope missing that role. */
  missing: Record<string, number>;
  /** Per role: missing pages the chosen source had no one for. */
  unresolved: Record<string, number>;
};

/**
 * A page's own `<role>@` people, when every one of them is an author record. "blocked" when any
 * is plain text (it can't be copied, and copying only the rest would drop someone); undefined
 * when the page has none.
 */
function linkedOwnCredits(
  entry: AuthorshipEntry | undefined,
  role: CreditRole,
): QuickFixPerson[] | "blocked" | undefined {
  const refs = creditsFor(entry?.pageCredits, role);
  if (refs.length === 0) return undefined;
  const own = refs.filter((r) => r.tag === roleInfo(role).tag);
  if (own.length !== refs.length || own.some((r) => !r.author)) return "blocked";
  return own.map((r) => ({ key: r.author!.nameKey, name: r.author!.name }));
}

/**
 * Plans filling in roles that scanned pages are missing. "parent" copies the nearest ancestor's
 * people for the role (the main page included), counting what this fix gives that ancestor;
 * "book" copies the book's people for the role. Only author records can be written, so an
 * ancestor whose attribution includes plain text stops the search: guessing past it could
 * credit the wrong people. `onlyIDs` limits which pages are changed; pages outside it still pass
 * their attribution down.
 */
export function planQuickFix(
  rows: AuthorshipRow[],
  roles: CreditRole[],
  source: QuickFixSource,
  bookPeople: Partial<Record<CreditRole, QuickFixPerson[]>>,
  onlyIDs?: Set<string>,
): QuickFixPlan {
  const items: QuickFixItem[] = [];
  const missing: Record<string, number> = {};
  const unresolved: Record<string, number> = {};
  for (const role of roles) {
    missing[role] = 0;
    unresolved[role] = 0;
  }

  // What each open ancestor passes down per role.
  type Inherited = Partial<Record<CreditRole, QuickFixPerson[] | "blocked">>;
  const stack: { depth: number; passes: Inherited }[] = [];

  for (const row of rows) {
    while (stack.length && stack[stack.length - 1].depth >= row.depth) stack.pop();
    const fromParent = stack[stack.length - 1]?.passes ?? {};
    const passes: Inherited = {};

    for (const role of roles) {
      const entry = row.entry;
      const own = linkedOwnCredits(entry, role);
      if (own) {
        passes[role] = own;
        continue;
      }

      const inScope = !!entry && entry.status === "completed" && (!onlyIDs || onlyIDs.has(row.id));
      const inherited = fromParent[role];
      if (!inScope) {
        passes[role] = inherited;
        continue;
      }

      missing[role] += 1;
      const fromBook = bookPeople[role]?.length ? bookPeople[role] : undefined;
      let people: QuickFixPerson[] | undefined;
      let from: QuickFixItem["from"] = "parent";
      if (source !== "book" && inherited !== "blocked") people = inherited;
      // With a parent fallback, a plain-text parent stops it; "book" ignores parents entirely.
      if (!people && (source === "book" || (source === "parent-then-book" && inherited !== "blocked"))) {
        people = fromBook;
        from = "book";
      }
      if (!people) {
        unresolved[role] += 1;
        passes[role] = inherited;
        continue;
      }
      items.push({ pageID: row.id, title: row.title, role, people, from });
      passes[role] = people;
    }

    stack.push({ depth: row.depth, passes });
  }

  return { items, missing, unresolved };
}
