/**
 * The books an auto-managed Collection should hold: its rule's matches plus the
 * admin's manual includes, minus the admin's manual excludes.
 *
 * An exclude wins over an include, so a book is never in both states at once.
 * Order is stable (rule matches first, then includes) so an unchanged collection
 * produces an identical write.
 */
export const applySyncOverrides = (
  matched: string[],
  includes: string[],
  excludes: string[],
): string[] => {
  const excluded = new Set(excludes);
  return [...new Set([...matched, ...includes])].filter((id) => !excluded.has(id));
};
