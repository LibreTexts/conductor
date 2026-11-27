/**
 * Quick picks for filtering by library: named groups of library subdomains.
 * Libraries not in any group (k12, espanol, dev) are still reachable one by
 * one from the list.
 */
export type LibraryGroup = { id: string; label: string; libraries: string[] };

export const LIBRARY_GROUPS: LibraryGroup[] = [
  { id: "stem", label: "STEM", libraries: ["bio", "chem", "eng", "geo", "math", "phys", "stats"] },
  { id: "health", label: "Health", libraries: ["med"] },
  { id: "humanities", label: "Humanities & social sciences", libraries: ["human", "socialsci"] },
  { id: "business", label: "Business & workforce", libraries: ["biz", "workforce"] },
];

/** A group's libraries that are actually on offer, in the group's order. */
export const groupSelection = (group: LibraryGroup, available: string[]): string[] =>
  group.libraries.filter((lib) => available.includes(lib));

/** Whether `selected` is exactly the group's available libraries. */
export const isGroupSelected = (group: LibraryGroup, available: string[], selected: string[]): boolean => {
  const libs = groupSelection(group, available);
  return libs.length > 0 && libs.length === selected.length && libs.every((lib) => selected.includes(lib));
};

// ── As options in a multi-select list ────────────────────────────────────────

/** Group options share the list's values with libraries, so they carry a prefix. */
const GROUP_PREFIX = "group:";
export const ALL_OPTION = `${GROUP_PREFIX}all`;
export const groupOption = (group: LibraryGroup) => `${GROUP_PREFIX}${group.id}`;
const isGroupOption = (value: string) => value.startsWith(GROUP_PREFIX);

/**
 * The list's value: the selected libraries, plus the "All" or group option
 * that matches them exactly, so that option shows as checked.
 */
export const listValue = (selected: string[], available: string[]): string[] => {
  if (selected.length === 0) return [ALL_OPTION];
  const groups = LIBRARY_GROUPS.filter((g) => isGroupSelected(g, available, selected)).map(groupOption);
  return [...selected, ...groups];
};

/**
 * The libraries selected after the list changed from `previous` to `next`.
 * Choosing "All" or a group replaces the selection with it; unchecking the
 * checked group goes back to every library; anything else toggles libraries.
 */
export const applyListChange = (previous: string[], next: string[], available: string[]): string[] => {
  const added = next.filter((v) => isGroupOption(v) && !previous.includes(v));
  if (added.length > 0) {
    const picked = added[added.length - 1];
    if (picked === ALL_OPTION) return [];
    const group = LIBRARY_GROUPS.find((g) => groupOption(g) === picked);
    return group ? groupSelection(group, available) : [];
  }
  if (previous.some((v) => isGroupOption(v) && v !== ALL_OPTION && !next.includes(v))) return [];
  return next.filter((v) => !isGroupOption(v));
};

/** What the closed list shows: "All libraries", a group's name, or the libraries. */
export const describeSelection = (selected: string[], available: string[]): string => {
  if (selected.length === 0) return "All libraries";
  const group = LIBRARY_GROUPS.find((g) => isGroupSelected(g, available, selected));
  return group ? group.label : selected.join(", ");
};
