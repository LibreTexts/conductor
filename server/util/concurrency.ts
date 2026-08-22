/**
 * Maps `items` through `fn` with at most `limit` promises outstanding.
 *
 * Bounds fan-out over collections whose size is set by the data rather than the
 * code — a library sync walks thousands of books, and a bare `Promise.all` over
 * that would open thousands of sockets against a single host at once.
 *
 * Results keep input order. `fn` rejecting rejects the whole call, so callers
 * that want per-item failures to be survivable must handle them inside `fn`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
