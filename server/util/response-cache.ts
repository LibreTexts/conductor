import NodeCache from "node-cache";
import { childLogger } from "../logger.js";

const logger = childLogger("response-cache");

export interface ResponseCache<T> {
  getOrLoad(key: string, loader: () => Promise<T>): Promise<T>;
  /** Drops a single key. Mostly useful from a script or a future write path. */
  invalidate(key: string): void;
}

export interface ResponseCacheOptions {
  /** How long a loaded value stays fresh. */
  ttlSeconds: number;
  /**
   * Hard ceiling on stored entries. Required, not defaulted: these caches sit
   * in front of public endpoints and store misses, so the caller has to state
   * how much memory the endpoint is allowed to hold.
   */
  maxKeys: number;
  /** Identifies the cache in logs. */
  name: string;
}

/**
 * A short-lived, in-process read cache for hot endpoints whose backing data
 * rarely changes.
 *
 * Two things happen here. Resolved values (including `null`, so misses are
 * cached too) are held for `ttlSeconds`, and concurrent loads of the same key
 * collapse into a single in-flight promise, so a burst of requests arriving on
 * a cold key costs one round trip instead of one per request.
 *
 * Rejections are never cached: the key is left empty and the next caller
 * retries.
 *
 * This lives in the process, not in Mongo or Redis. Every container holds its
 * own copy, so a write made elsewhere becomes visible only once the TTL lapses.
 * Only cache data where that staleness window is acceptable.
 *
 * Storage is capped at `maxKeys`. Callers are public endpoints that cache
 * misses, so a client walking valid-but-nonexistent keys would otherwise grow
 * the heap unchecked until the TTL swept it. At the cap we stop admitting new
 * keys and serve those loads straight from the loader, rather than evicting to
 * make room: refusing admission keeps the genuinely hot entries resident, while
 * LRU or FIFO eviction would let a flood of one-shot keys push them out. The
 * effect of a flood is that the cache stops helping for unseen keys, never that
 * the process runs out of memory.
 *
 * `useClones: false` means callers share the stored object. Treat anything
 * returned as read-only.
 */
export function createResponseCache<T>(
  opts: ResponseCacheOptions
): ResponseCache<T> {
  const cache = new NodeCache({
    stdTTL: opts.ttlSeconds,
    checkperiod: opts.ttlSeconds,
    useClones: false,
    maxKeys: opts.maxKeys,
  });
  const inFlight = new Map<string, Promise<T>>();

  // node-cache throws ECACHEFULL from `set` once maxKeys is reached. That is a
  // normal, self-healing state (the next checkperiod sweep frees slots), so it
  // must never fail the request. Log it at most once per TTL window: a flood
  // would otherwise emit a line per request, which is its own resource problem.
  let lastFullWarnAt = 0;

  const admit = (key: string, value: T) => {
    try {
      cache.set(key, value);
    } catch (err) {
      const now = Date.now();
      if (now - lastFullWarnAt >= opts.ttlSeconds * 1000) {
        lastFullWarnAt = now;
        logger.warn(
          { err, cache: opts.name, maxKeys: opts.maxKeys, keys: cache.keys().length },
          "Response cache is full; new keys are being served uncached"
        );
      }
    }
  };

  return {
    async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
      // `has` rather than a truthiness check on `get`, so a cached `null` is a
      // hit instead of falling through to the loader on every request.
      if (cache.has(key)) {
        logger.debug({ cache: opts.name, key }, "Cache hit");
        return cache.get<T>(key) as T;
      }

      const existing = inFlight.get(key);
      if (existing) {
        return existing;
      }

      const pending = (async () => {
        const value = await loader();
        admit(key, value);
        return value;
      })();

      inFlight.set(key, pending);

      try {
        return await pending;
      } finally {
        inFlight.delete(key);
      }
    },

    invalidate(key: string) {
      cache.del(key);
    },
  };
}
