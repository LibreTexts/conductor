/**
 * Helpers for Author "groups": an Author record that stands for several individual
 * authors (see `groupMembers` on the Author model).
 *
 * Shared by the Authors API and the library sync so both resolve a group identically.
 */

/** The affiliation fields a group membership may override for one member. */
export const MEMBER_OVERRIDE_FIELDS = [
  "campusName",
  "campusURL",
  "programName",
  "programURL",
] as const;

type OverrideField = (typeof MEMBER_OVERRIDE_FIELDS)[number];

export type GroupMemberRef = { nameKey: string } & Partial<Record<OverrideField, string>>;

type AuthorLike = {
  nameKey: string;
  name: string;
  campusName?: string;
  campusURL?: string;
  groupMembers?: GroupMemberRef[];
  autoName?: boolean;
};

export const isAuthorGroup = (author?: { groupMembers?: unknown[] } | null): boolean =>
  !!author?.groupMembers?.length;

/**
 * The members of a group as they apply in that group: each individual's own record with
 * the membership's affiliation overrides laid over it. Members that no longer resolve are
 * skipped, and the same individual is only listed once.
 */
export function expandGroupMembers<T extends AuthorLike>(
  group: AuthorLike,
  lookup: (nameKey: string) => T | undefined
): T[] {
  const seen = new Set<string>();
  const members: T[] = [];

  for (const ref of group.groupMembers ?? []) {
    const base = lookup(ref.nameKey);
    if (!base || seen.has(base.nameKey)) continue;
    seen.add(base.nameKey);

    const effective: T = { ...base };
    delete effective.groupMembers;
    delete effective.autoName;
    for (const field of MEMBER_OVERRIDE_FIELDS) {
      if (ref[field]) (effective as Record<string, unknown>)[field] = ref[field];
    }
    members.push(effective);
  }

  return members;
}

/** Distinct, non-empty values in order of first appearance. */
const distinct = (values: (string | undefined)[]): string[] => [
  ...new Set(values.filter((v): v is string => !!v)),
];

/**
 * What a reader that only understands single authors should see for a group: the members'
 * names joined together (unless the group has a custom name). The group's own campus wins
 * when it has one; otherwise the members' campuses are joined, and `campusURL` is only kept
 * when every member agrees on it, since one URL can't stand for many.
 */
export function describeGroup(
  group: AuthorLike,
  members: AuthorLike[]
): { name: string; campusName?: string; campusURL?: string } {
  if (group.campusName) {
    return {
      name: describeName(group, members),
      campusName: group.campusName,
      campusURL: group.campusURL,
    };
  }

  const campusNames = distinct(members.map((m) => m.campusName));
  const campusURLs = distinct(members.map((m) => m.campusURL));

  return {
    name: describeName(group, members),
    campusName: campusNames.join(", ") || undefined,
    campusURL: campusURLs.length === 1 ? campusURLs[0] : group.campusURL,
  };
}

const describeName = (group: AuthorLike, members: AuthorLike[]): string =>
  group.autoName === false || members.length === 0
    ? group.name
    : members.map((m) => m.name).join(", ");
