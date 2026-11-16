/**
 * A library's change feed (`/@api/deki/events/page-hierarchy/home`), reduced to
 * what provenance acts on. Pure: the events service does the reading and the
 * writes.
 *
 * Feed facts (probed on dev):
 * - newest first, up to `limit` summaries per call; `@since` of a response,
 *   passed back as `upto=`, returns the next older page;
 * - every event has `@mt-epoch` (ms), a reliable numeric cursor;
 * - a summary with `@count` > 1 stands for several events, listed by its
 *   `@uri.detail` (a cascading delete is one per page).
 */

/** Event types that change what provenance knows. Everything else is noise. */
export const RELEVANT_EVENT_TYPES = new Set([
  "page.content:update",
  "page:delete",
  "page:restore",
  "page:move",
  "page:create",
  "page.displayname:update",
]);

export type FeedEvent = {
  /**
   * `@mt-epoch`: MindTouch's own millisecond counter (not Unix time; it
   * counts from 1990). Only ever compared, as the cursor.
   */
  epoch: number;
  /** When it happened, from `@datetime`. */
  at?: Date;
  type: string;
  pageID: number;
  path?: string;
  title?: string;
  /** The page's new revision (content updates). */
  revision?: number;
  /** For a cascading delete, the page the delete started from. */
  rootPageID?: number;
  /** For a move, the page's previous path. */
  fromPath?: string;
  comment?: string;
};

export type FeedSummary = {
  /** Newest event epoch the summary stands for. */
  epoch: number;
  /** Events grouped under the summary; > 1 means read `detailUrl` for all. */
  count: number;
  detailUrl?: string;
  /** The representative event, already filtered to relevant types. */
  event: FeedEvent | null;
  /** The event type, even for noise, so grouped noise isn't expanded. */
  type: string;
};

const int = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

const text = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  const t = (value as { "#text"?: unknown } | null)?.["#text"];
  return typeof t === "string" ? t : undefined;
};

/** One raw event object to a {@link FeedEvent}, or null for noise / malformed. */
export const parseEvent = (raw: any): FeedEvent | null => {
  if (!raw || typeof raw !== "object") return null;
  const type = String(raw["@type"] ?? "");
  if (!RELEVANT_EVENT_TYPES.has(type)) return null;
  const epoch = int(raw["@mt-epoch"]);
  const pageID = int(raw.page?.["@id"]);
  if (epoch === undefined || !pageID) return null;
  const revision = int(raw.revision);
  const rootPageID = int(raw["root.page"]?.["@id"]);
  const comment = typeof raw["change-comment"] === "string" ? raw["change-comment"] : undefined;
  const at = typeof raw["@datetime"] === "string" ? new Date(raw["@datetime"]) : undefined;
  return {
    epoch,
    ...(at && !Number.isNaN(at.getTime()) ? { at } : {}),
    type,
    pageID,
    path: text(raw.page?.path),
    title: typeof raw.page?.title === "string" ? raw.page.title : undefined,
    ...(revision !== undefined && revision > 0 ? { revision } : {}),
    ...(rootPageID ? { rootPageID } : {}),
    ...(raw["source.page"] ? { fromPath: text(raw["source.page"]?.path) } : {}),
    ...(comment ? { comment } : {}),
  };
};

/** A feed or detail response's summaries, newest first, as returned. */
export const parseEventSummaries = (json: any): FeedSummary[] => {
  const raw = json?.summary;
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((s) => {
    const rawEvent = s?.event;
    const epoch = int(rawEvent?.["@mt-epoch"]) ?? 0;
    return {
      epoch,
      count: int(s?.["@count"]) ?? 1,
      detailUrl: typeof s?.["@uri.detail"] === "string" ? s["@uri.detail"] : undefined,
      event: parseEvent(rawEvent),
      type: String(rawEvent?.["@type"] ?? ""),
    };
  });
};

/** What provenance already knows about one page. */
export type TrackedPage = {
  isSource: boolean;
  bookID: string | null;
  revision?: number;
  deleted: boolean;
};

export type FeedPlan = {
  /**
   * Reused pages outside any scanned book whose revision moved: record a
   * source change now. (Pages in a scanned book are re-read with their book,
   * which records their source changes itself.)
   */
  sourceRevisions: { nodeID: string; fromRev: number; toRev: number; changedAt: Date }[];
  /** Tracked pages that are gone. */
  deletions: string[];
  /** Tracked pages' new titles and paths. */
  updates: { nodeID: string; title?: string; path?: string }[];
  /** Books to re-read: a tracked page in them changed, moved, came back or was added. */
  booksToRescan: string[];
  /** The newest event seen: the library's next cursor. */
  newestEpoch: number | null;
};

/**
 * Turns a library's new events into provenance actions. Events apply oldest
 * first; for each page the latest state wins (a page deleted then restored
 * is not deleted).
 *
 * @param tracked - by nodeID, the pages provenance has nodes for.
 * @param parentOf - for created pages, their parent's page id (looked up by
 *   the caller), so a page added to a scanned book queues that book.
 * @param queueBooks - false for libraries whose books are never backfilled
 *   (`PROVENANCE_EXCLUDED_LIBRARIES`): their reused pages are still watched.
 */
export const planFeedActions = (
  lib: string,
  events: FeedEvent[],
  tracked: Map<string, TrackedPage>,
  { parentOf = new Map<number, number>(), queueBooks = true }: {
    parentOf?: Map<number, number>;
    queueBooks?: boolean;
  } = {},
): FeedPlan => {
  const ordered = [...events].sort((a, b) => a.epoch - b.epoch);
  const nodeOf = (pageID: number) => `${lib}-${pageID}`;

  const deleted = new Set<string>();
  const books = new Set<string>();
  const updates = new Map<string, { title?: string; path?: string }>();
  const revisions = new Map<string, { fromRev: number; toRev: number; changedAt: Date }>();
  let newestEpoch: number | null = null;

  const queue = (bookID: string | null | undefined) => {
    if (queueBooks && bookID) books.add(bookID);
  };

  for (const event of ordered) {
    newestEpoch = newestEpoch === null ? event.epoch : Math.max(newestEpoch, event.epoch);
    const nodeID = nodeOf(event.pageID);
    const page = tracked.get(nodeID);

    switch (event.type) {
      case "page.content:update": {
        if (!page) break;
        if (page.bookID) {
          queue(page.bookID);
        } else if (page.isSource && event.revision !== undefined && page.revision !== undefined) {
          const prev = revisions.get(nodeID);
          const fromRev = prev?.fromRev ?? page.revision;
          if (event.revision > fromRev) {
            revisions.set(nodeID, { fromRev, toRev: event.revision, changedAt: event.at ?? new Date() });
          }
        }
        break;
      }
      case "page:delete":
        if (page && !page.deleted) deleted.add(nodeID);
        break;
      case "page:restore":
        deleted.delete(nodeID);
        if (page) queue(page.bookID);
        break;
      case "page:move":
        if (!page) break;
        updates.set(nodeID, { ...updates.get(nodeID), ...(event.path ? { path: event.path } : {}) });
        queue(page.bookID);
        break;
      case "page.displayname:update":
        if (!page || !event.title) break;
        updates.set(nodeID, { ...updates.get(nodeID), title: event.title });
        break;
      case "page:create": {
        if (page) {
          queue(page.bookID);
          break;
        }
        const parent = parentOf.get(event.pageID);
        if (parent) queue(tracked.get(nodeOf(parent))?.bookID);
        break;
      }
      default:
        break;
    }
  }

  return {
    sourceRevisions: [...revisions.entries()]
      .filter(([nodeID]) => !deleted.has(nodeID))
      .map(([nodeID, r]) => ({ nodeID, ...r })),
    deletions: [...deleted],
    updates: [...updates.entries()]
      .filter(([nodeID]) => !deleted.has(nodeID))
      .map(([nodeID, u]) => ({ nodeID, ...u })),
    booksToRescan: [...books].sort(),
    newestEpoch,
  };
};
