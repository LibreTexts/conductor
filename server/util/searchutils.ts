export function levenshteinDistance(a: string, b: string) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const dp = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Sorts two values without considering case or punctuation. Null/undefined values are sorted to the beginning.
 * Casts inputs to strings for comparison.
 * @param a
 * @param b
 * @returns {Number} the sort order of the two strings
 */
export const normalizedSort = (a: any, b: any): number => {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return String(a).localeCompare(String(b), undefined, {
    sensitivity: "base",
    ignorePunctuation: true,
  });
};