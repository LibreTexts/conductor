/**
 * Reading and writing credit tags (author, editor, remixer, …) on library pages. Pure
 * functions, shared by the Attribution Manager's scan and its API, and kept free of
 * database/library imports so they are easy to test.
 *
 * Every role is written as `<role>@<authorKey>`, one per role per page. The tag names match
 * what the Pressbooks importer already writes (`author@`, `editor@`, `contributor@`,
 * `translator@`, `illustrator@`, `reviewedBy@`), plus `remixer@`.
 */

export const CREDIT_ROLES = [
  "author",
  "editor",
  "remixer",
  "translator",
  "contributor",
  "illustrator",
  "reviewedBy",
] as const;

export type CreditRole = (typeof CREDIT_ROLES)[number];

export type CreditTagRef = {
  role: CreditRole;
  /** The tag prefix the value was read from: `<role>@`, or `authorname:` for older author tags. */
  tag: string;
  value: string;
};

export const AUTHOR_NAME_TAG_PREFIX = "authorname:";

export const roleTagPrefix = (role: CreditRole) => `${role}@`;

/** Every `<role>@` prefix. Other tag editors must keep these, like other system tags. */
export const CREDIT_TAG_PREFIXES = CREDIT_ROLES.map(roleTagPrefix);

/**
 * The tags a page carries for one role: every `<role>@` tag. For the author role only, a page
 * with no `author@` tag falls back to its older `authorname:` tag.
 */
export function readRoleTags(tagValues: string[], role: CreditRole): CreditTagRef[] {
  const prefix = roleTagPrefix(role);
  const tags = tagValues
    .filter((t) => t.startsWith(prefix))
    .map((t) => t.slice(prefix.length).trim())
    .filter(Boolean)
    .map((value) => ({ role, tag: prefix, value }));
  if (tags.length > 0 || role !== "author") return tags;

  const nameTag = tagValues
    .find((t) => t.startsWith(AUTHOR_NAME_TAG_PREFIX))
    ?.slice(AUTHOR_NAME_TAG_PREFIX.length)
    .trim();
  return nameTag ? [{ role, tag: AUTHOR_NAME_TAG_PREFIX, value: nameTag }] : [];
}

/** Every credit tag a page carries, across all roles. */
export function readAllCreditTags(tagValues: string[]): CreditTagRef[] {
  return CREDIT_ROLES.flatMap((role) => readRoleTags(tagValues, role));
}

/**
 * A page's tags with one role's `<role>@` tags replaced by `<role>@<authorKey>` (or removed when
 * `authorKey` is null). Every other tag, other roles and `authorname:` included, is kept as is.
 */
export function replaceRoleTag(
  tagValues: string[],
  role: CreditRole,
  authorKey: string | null,
): string[] {
  const prefix = roleTagPrefix(role);
  const kept = tagValues.filter((t) => !t.startsWith(prefix));
  return authorKey ? [...kept, `${prefix}${authorKey}`] : kept;
}

// ── Book-level credits ────────────────────────────────────────────────────────
// Written on the book's main page as `book<role>@<authorKey>` (bookauthor@, bookeditor@, …).
// Unlike page credits, a book can carry several people per role. They are separate from the
// main page's own `<role>@` credits: `bookauthor@` doesn't start with `author@`, so neither
// set touches the other.

export const bookTagPrefix = (role: CreditRole) => `book${role}@`;

export const BOOK_CREDIT_TAG_PREFIXES = CREDIT_ROLES.map(bookTagPrefix);

/** Every `book<role>@` tag on a page, in tag order, several per role allowed. */
export function readBookCredits(tagValues: string[]): CreditTagRef[] {
  return CREDIT_ROLES.flatMap((role) => {
    const prefix = bookTagPrefix(role);
    return tagValues
      .filter((t) => t.startsWith(prefix))
      .map((t) => t.slice(prefix.length).trim())
      .filter(Boolean)
      .map((value) => ({ role, tag: prefix, value }));
  });
}

/** Adds `book<role>@<key>` tags that aren't there yet. Every other tag is kept as it is. */
export function addBookCredits(
  tagValues: string[],
  items: { role: CreditRole; key: string }[],
): string[] {
  const next = [...tagValues];
  for (const { role, key } of items) {
    const tag = `${bookTagPrefix(role)}${key}`;
    if (!next.includes(tag)) next.push(tag);
  }
  return next;
}

/** Removes one `book<role>@<key>` tag. Every other tag is kept as it is. */
export function removeBookCredit(tagValues: string[], role: CreditRole, key: string): string[] {
  const tag = `${bookTagPrefix(role)}${key}`;
  return tagValues.filter((t) => t !== tag);
}

/** Distinct refs, in order of first appearance. */
export function distinctCreditRefs(refs: CreditTagRef[]): CreditTagRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const id = `${r.role}|${r.tag}${r.value}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
