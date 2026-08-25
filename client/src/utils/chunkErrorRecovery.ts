const RELOAD_MARKER_KEY = "conductor:chunk-reload";
const RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Failed to fetch dynamically/i;

/**
 * True when an error is a failed lazy-chunk fetch rather than an application error.
 * Message text varies by browser, hence the pattern.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
      ? `${error.name} ${error.message}`
      : String((error as any)?.message ?? "");
  return CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Reloads once to pick up the current build, at most once per cooldown window.
 * Returns false when a reload was already attempted recently, so the caller can fall
 * back to showing the user something rather than looping.
 */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_MARKER_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
  } catch (e) {
    // Private mode / storage disabled: without a marker a reload loop is possible, so don't.
    return false;
  }
  window.location.reload();
  return true;
}

let inFlightRetries = 0;

/**
 * Marks a lazy import as being retried by lazyWithRetry. While any retry is outstanding
 * the global listeners below stand down, so a first failed fetch doesn't reload the tab
 * out from under a retry that is about to succeed.
 */
export function beginChunkImportRetry(): void {
  inFlightRetries += 1;
}

export function endChunkImportRetry(): void {
  inFlightRetries = Math.max(0, inFlightRetries - 1);
}

/**
 * A deploy replaces the hashed chunk filenames a loaded tab was built against, so any
 * later lazy import in that tab can 404. Recover by reloading into the current build
 * instead of surfacing a fatal error. Guarded so a chunk that is genuinely unreachable
 * can't put the tab into a reload loop.
 *
 * These listeners are only a safety net for dynamic imports that don't go through
 * lazyWithRetry; that helper owns the reload decision for everything it wraps.
 */
export default function registerChunkErrorRecovery(): void {
  window.addEventListener("vite:preloadError", () => {
    // Deliberately no preventDefault(): Vite only rethrows the failure when the event
    // is left un-prevented, and that rejection is what lets lazyWithRetry catch and
    // retry. Preventing it resolves the import as `undefined` and kills the retry path.
    if (inFlightRetries > 0) return;
    reloadForNewBuild();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (inFlightRetries > 0) return;
    if (isChunkLoadError(event.reason)) {
      reloadForNewBuild();
    }
  });
}
