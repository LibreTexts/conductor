import { childLogger } from "../../logger.js";
import Library from "../../models/library.js";
import PageNode from "../../models/pagenode.js";
import ProvenanceScanState from "../../models/provenancescanstate.js";
import { generateAPIRequestHeaders } from "../../util/librariesclient.js";
import { librariesOptions } from "../../util/libraries.js";
import {
  planFeedActions,
  readFeed,
  type FeedEvent,
  type FeedReadResult,
  type FeedPlan,
  type TrackedPage,
} from "../../util/library-events.js";
import { createThrottle } from "./library-sync-service.js";
import { deletePageWithNotice, recordSourceChange } from "./page-provenance-service.js";
import {
  EXCLUDED_LIBRARIES,
  ScanLease,
  fetchLibraryPage,
  scanSpecificBooks,
} from "./provenance-scan-service.js";

/**
 * The changes job: reads each library's change feed
 * (`/@api/deki/events/page-hierarchy/home`) from where it last stopped and
 * brings provenance up to date. Triggered only by the scheduled
 * `PUT /provenance/automation/changes`; nothing on the library side calls
 * Conductor. Read-only against the libraries.
 *
 * Per library it:
 * - records source changes of reused pages outside scanned books,
 * - marks deleted pages (breaking live reuse of them, telling their leads),
 * - updates moved/renamed pages' paths and titles,
 * - queues the books whose pages changed, which it then re-reads.
 */

const eventsLog = childLogger("provenance-events");

const FEED_LIMIT = 200;
/** Feed pages (of {@link FEED_LIMIT} summaries) read per library per run before calling it a gap. */
const MAX_FEED_PAGES = Math.max(1, parseInt(process.env.PROVENANCE_EVENTS_MAX_PAGES ?? "", 10) || 25);
const REQUEST_INTERVAL_MS = 250;
const REQUEST_ATTEMPTS = 3;
/** New pages whose parent is looked up per library per run (one read each). */
const MAX_PARENT_LOOKUPS = 100;
export const DEFAULT_CHANGES_BUDGET_MS = 10 * 60 * 1000;

type Throttle = ReturnType<typeof createThrottle>;

/** One feed or detail request, retrying passing 5xx/429 answers. Null on failure. */
const getFeedJson = async (throttle: Throttle, lib: string, url: string): Promise<any | null> => {
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const headers = await generateAPIRequestHeaders(lib);
    if (!headers) return null;
    const res = await throttle(() => fetch(url, { headers: headers as unknown as Record<string, string> }));
    if (res.ok) return res.json().catch(() => null);
    const retryable = res.status >= 500 || res.status === 429;
    if (!retryable || attempt === REQUEST_ATTEMPTS) {
      eventsLog.warn({ library: lib, status: res.status }, "Change feed request failed");
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  return null;
};

const withJsonFormat = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}dream.out.format=json`;

const feedUrl = (lib: string, upto?: string) =>
  `https://${lib}.libretexts.org/@api/deki/events/page-hierarchy/home?dream.out.format=json&limit=${FEED_LIMIT}${
    upto ? `&upto=${encodeURIComponent(upto)}` : ""
  }`;

export type FeedRead = FeedReadResult;

/** A detail link the library's token may be sent to: that library, over HTTPS. */
const isLibraryUrl = (lib: string) => (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === `${lib}.libretexts.org`;
  } catch {
    return false;
  }
};

/**
 * Reads a library's feed from the newest event back past `sinceEpoch` (see
 * `readFeed`). With no cursor it reads one page, to learn the newest epoch.
 */
export const readLibraryFeed = (
  lib: string,
  sinceEpoch: number | null,
  { maxPages = MAX_FEED_PAGES, throttle = createThrottle(REQUEST_INTERVAL_MS) } = {},
): Promise<FeedRead> =>
  readFeed({
    sinceEpoch,
    maxPages,
    fetchPage: (upto) => getFeedJson(throttle, lib, feedUrl(lib, upto)),
    fetchDetail: (url) => getFeedJson(throttle, lib, withJsonFormat(url)),
    isAllowedDetailUrl: isLibraryUrl(lib),
  });

export type LibraryChangesOutcome = {
  library: string;
  status: "applied" | "baseline" | "dry-run" | "busy" | "failed" | "error";
  events?: number;
  pages?: number;
  gap?: boolean;
  sourceChanges?: number;
  deletions?: number;
  updates?: number;
  booksQueued?: number;
  /** Only on a dry run: what would be done. */
  plan?: FeedPlan;
  error?: string;
};

/** Parent page ids of created pages that aren't tracked yet, so their book can be queued. */
const lookUpParents = async (
  lib: string,
  events: FeedEvent[],
  tracked: Map<string, TrackedPage>,
  throttle: Throttle,
): Promise<Map<number, number>> => {
  const parentOf = new Map<number, number>();
  const created = [
    ...new Set(
      events
        .filter((e) => e.type === "page:create" && !tracked.has(`${lib}-${e.pageID}`))
        .map((e) => e.pageID),
    ),
  ].slice(0, MAX_PARENT_LOOKUPS);
  for (const pageID of created) {
    const res = await fetchLibraryPage(throttle, lib, pageID, "?dream.out.format=json");
    if (!res.ok) continue;
    const page = await res.json().catch(() => null);
    const parent = parseInt(String(page?.["page.parent"]?.["@id"] ?? ""), 10);
    if (Number.isFinite(parent) && parent > 0) parentOf.set(pageID, parent);
  }
  return parentOf;
};

/**
 * Reads one library's feed from its cursor and applies what it shows. The
 * first run only records the newest event as the cursor (history is the
 * backfill's job). Holds the library's scan lease while it writes.
 */
export const applyLibraryFeed = async (
  lib: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<LibraryChangesOutcome> => {
  const lease = dryRun ? null : await ScanLease.acquire(lib);
  if (!dryRun && !lease) return { library: lib, status: "busy" };

  try {
    // Read under the lease, so a queue another run just emptied isn't
    // written back from a stale copy.
    const state = await ProvenanceScanState.findOne(
      { library: { $eq: lib } },
      { _id: 0, eventsCursor: 1, pendingRescanBooks: 1 },
    ).lean();
    const since = state?.eventsCursor ?? null;

    const throttle = createThrottle(REQUEST_INTERVAL_MS);
    const read = await readLibraryFeed(lib, since, { throttle });
    if (read.failed) {
      // The cursor stays, so the next run reads the same span again.
      eventsLog.warn({ library: lib, pages: read.pages }, "Change feed read incomplete; will retry next run");
      return { library: lib, status: "failed" };
    }
    if (read.skippedDetails > 0) {
      eventsLog.warn(
        { library: lib, skippedDetails: read.skippedDetails },
        "Grouped feed events with a detail link off the library's host were not expanded",
      );
    }

    const now = new Date();
    if (since === null) {
      if (!dryRun && read.newestEpoch !== null) {
        await lease!.save({ eventsCursor: read.newestEpoch, eventsPolledAt: now });
      }
      return { library: lib, status: dryRun ? "dry-run" : "baseline", pages: read.pages };
    }

    const nodeIDs = [...new Set(read.events.map((e) => `${lib}-${e.pageID}`))];
    const nodes = nodeIDs.length
      ? await PageNode.find(
          { nodeID: { $in: nodeIDs } },
          { _id: 0, nodeID: 1, isSource: 1, bookID: 1, revision: 1, deletedAt: 1 },
        ).lean<{ nodeID: string; isSource?: boolean; bookID?: string | null; revision?: number; deletedAt?: Date | null }[]>()
      : [];
    const tracked = new Map<string, TrackedPage>(
      nodes.map((n) => [
        n.nodeID,
        { isSource: !!n.isSource, bookID: n.bookID ?? null, revision: n.revision, deleted: !!n.deletedAt },
      ]),
    );
    const queueBooks = !EXCLUDED_LIBRARIES.has(lib.toLowerCase());
    const parentOf = queueBooks ? await lookUpParents(lib, read.events, tracked, throttle) : new Map();
    const plan = planFeedActions(lib, read.events, tracked, { parentOf, queueBooks });

    const summary = {
      events: read.events.length,
      pages: read.pages,
      gap: read.gap,
      sourceChanges: plan.sourceRevisions.length,
      deletions: plan.deletions.length,
      updates: plan.updates.length,
      booksQueued: plan.booksToRescan.length,
    };
    if (dryRun) return { library: lib, status: "dry-run", ...summary, plan };

    for (const nodeID of plan.deletions) await deletePageWithNotice(nodeID, now);
    for (const change of plan.sourceRevisions) {
      await recordSourceChange({
        sourceId: change.nodeID,
        fromRev: change.fromRev,
        toRev: change.toRev,
        changedAt: change.changedAt,
      });
      await PageNode.updateOne(
        { nodeID: { $eq: change.nodeID } },
        { $set: { revision: change.toRev, sourceCheckedAt: now } },
      );
    }
    if (plan.updates.length > 0) {
      await PageNode.bulkWrite(
        plan.updates.map((u) => ({
          updateOne: {
            filter: { nodeID: u.nodeID },
            update: { $set: { ...(u.title ? { title: u.title } : {}), ...(u.path ? { path: u.path } : {}) } },
          },
        })),
        { ordered: false },
      );
    }

    const pending = [...new Set([...(state?.pendingRescanBooks ?? []), ...plan.booksToRescan])].sort();
    const set: Record<string, unknown> = {
      eventsCursor: read.newestEpoch ?? since,
      eventsPolledAt: now,
      pendingRescanBooks: pending,
      // A clean read clears an earlier gap's warning; the log keeps its history.
      eventsGapAt: read.gap ? now : null,
    };
    if (read.gap) {
      // Events between the cursor and what was read were skipped: let the
      // safety nets catch up now rather than on their slow schedules.
      set.lastCompletedAt = new Date(0);
      await PageNode.updateMany(
        { lib: { $eq: lib }, isSource: true },
        { $set: { sourceCheckedAt: null } },
      );
      eventsLog.warn({ library: lib, pages: read.pages }, "Change feed gap: queued a full source check and library re-walk");
    }
    // The cursor and the queued books are saved together, so a crash can't
    // advance one without the other.
    await lease!.save(set as never);

    eventsLog.info({ library: lib, ...summary }, "Library change feed applied");
    return { library: lib, status: "applied", ...summary };
  } catch (err) {
    eventsLog.error({ err, library: lib }, "Failed to apply library change feed");
    return { library: lib, status: "error", error: err instanceof Error ? err.message : String(err) };
  } finally {
    await lease?.release();
  }
};

let changesRunning = false;

/** True while this instance runs the changes job. */
export const isProvenanceChangesRunning = (): boolean => changesRunning;

export type ChangesRunOutcome = {
  libraries: LibraryChangesOutcome[];
  /** Books re-read from the queue, and books still waiting for a later run. */
  booksRescanned: number;
  booksWaiting: number;
};

/**
 * One run of the changes job: every library's feed, the library read longest
 * ago first, then the queue of books to re-read, all within `budgetMs`. A
 * library or book the budget doesn't reach is picked up by the next run.
 */
export const runLibraryChanges = async ({
  libraries,
  budgetMs = DEFAULT_CHANGES_BUDGET_MS,
  dryRun = false,
}: { libraries?: string[]; budgetMs?: number; dryRun?: boolean } = {}): Promise<ChangesRunOutcome> => {
  if (changesRunning && !dryRun) throw new Error("The changes job is already running on this instance.");
  if (!dryRun) changesRunning = true;
  try {
    const deadline = Date.now() + budgetMs;
    const [synced, sourceLibs, states] = await Promise.all([
      Library.find({ hidden: false, syncSupported: true }, { _id: 0, subdomain: 1 }).lean<{ subdomain: string }[]>(),
      // One indexed lookup per known library, not a walk over every reused page.
      Promise.all(
        librariesOptions.map(async (lib) => ((await PageNode.exists({ lib, isSource: true })) ? lib : null)),
      ).then((libs) => libs.filter((lib): lib is string => lib !== null)),
      ProvenanceScanState.find({}, { _id: 0, library: 1, eventsPolledAt: 1, pendingRescanBooks: 1 }).lean(),
    ]);
    let libs = [...new Set([...synced.map((l) => l.subdomain), ...sourceLibs])];
    if (libraries?.length) {
      const wanted = new Set(libraries.map((l) => l.toLowerCase()));
      libs = libs.filter((l) => wanted.has(l.toLowerCase()));
    }
    const polledAt = new Map(states.map((s) => [s.library, s.eventsPolledAt?.getTime() ?? 0]));
    libs.sort((a, b) => (polledAt.get(a) ?? 0) - (polledAt.get(b) ?? 0) || a.localeCompare(b));

    const outcomes: LibraryChangesOutcome[] = [];
    for (const lib of libs) {
      if (Date.now() >= deadline) break;
      outcomes.push(await applyLibraryFeed(lib, { dryRun }));
    }

    let booksRescanned = 0;
    let booksWaiting = 0;
    if (!dryRun) {
      const queued = await ProvenanceScanState.find(
        { library: { $in: libs }, "pendingRescanBooks.0": { $exists: true } },
        { _id: 0, library: 1, pendingRescanBooks: 1 },
      ).lean();
      for (const { library, pendingRescanBooks = [] } of queued) {
        if (Date.now() >= deadline) {
          booksWaiting += pendingRescanBooks.length;
          continue;
        }
        const results = await scanSpecificBooks(pendingRescanBooks, deadline, false);
        const done = results.flatMap((r) => r.scannedBooks ?? []);
        if (done.length > 0) {
          await ProvenanceScanState.updateOne(
            { library: { $eq: library } },
            { $pull: { pendingRescanBooks: { $in: done } } },
          );
        }
        booksRescanned += done.length;
        booksWaiting += pendingRescanBooks.length - done.length;
      }
    }

    eventsLog.info(
      {
        libraries: outcomes.length,
        applied: outcomes.filter((o) => o.status === "applied").length,
        booksRescanned,
        booksWaiting,
        dryRun,
      },
      "Changes job finished",
    );
    return { libraries: outcomes, booksRescanned, booksWaiting };
  } finally {
    if (!dryRun) changesRunning = false;
  }
};
