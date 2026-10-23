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
