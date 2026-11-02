/**
 * Merges the tags a caller wants on a page with the protected ("system") tags the page already
 * has. For each protected prefix, the caller's tags win when it sends any with that prefix, and
 * the page's existing ones are kept otherwise. Every tag of a prefix is kept, since a prefix can
 * legitimately repeat (several `author@` or `bookauthor@` tags). Duplicates are dropped.
 */
export function mergeSystemTags(
  currentTags: string[],
  incomingTags: string[],
  protectedPrefixes: string[],
): string[] {
  const prefixOf = (tag: string) => protectedPrefixes.find((p) => tag.startsWith(p));
  const sentPrefixes = new Set(incomingTags.map(prefixOf).filter(Boolean));
  const keptSystemTags = currentTags.filter((tag) => {
    const prefix = prefixOf(tag);
    return prefix !== undefined && !sentPrefixes.has(prefix);
  });
  return [...new Set([...keptSystemTags, ...incomingTags])];
}
