import { FilterQuery } from "mongoose";
import Book, { BookInterface } from "../../models/book.js";
import Collection, {
  CollectionShelfInterface,
  CollectionSyncMode,
} from "../../models/collection.js";
import { childLogger } from "../../logger.js";

/**
 * The fields the reconcile reads off an auto-managed Collection.
 *
 * Declared structurally rather than as `CollectionInterface`, which extends
 * mongoose's `Document` — a `.lean()` read returns plain objects, and typing them
 * as documents would advertise methods that aren't there.
 */
type AutoManagedCollection = {
  collID: string;
  orgID: string;
  title?: string;
  syncMode?: CollectionSyncMode;
  program?: string;
  locations?: ("central" | "campus")[];
  syncShelves?: CollectionShelfInterface[];
  resources?: { resourceType: "resource" | "collection"; resourceID: string }[];
};

const collectionSyncLog = childLogger("collection-sync");

/**
 * How many bookIDs a single log line will name before it reports a count instead.
 *
 * A first sync of a shelf collection legitimately adds thousands of books; the
 * useful part of that line is the handful you can eyeball plus the total.
 */
const LOGGED_ID_LIMIT = 25;

/**
 * Escapes a string for literal use inside a RegExp.
 *
 * Shelf paths are admin-supplied and routinely contain `(`, `)`, `+`, and `.` —
 * unescaped, `Map:_Organic_Chemistry_(Bruice)` is a grouping expression that
 * matches the wrong books, and a leading `*` throws.
 */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether collection syncing is in dry-run mode, from `COLLECTION_SYNC_DRY_RUN`.
 *
 * Throws on a value it cannot read rather than falling back to a real sync.
 * Setting the variable at all means somebody wanted to withhold the writes, and
 * promoting a typo into a live reconcile would rewrite every auto-managed
 * collection in the database — exactly what they were trying to avoid.
 *
 * Only an unset variable means "sync normally". An empty or blank value is a
 * value somebody wrote (`COLLECTION_SYNC_DRY_RUN=` in a .env file is the usual
 * way), so it takes the same error path as a typo instead of reading as false.
 */
export const isCollectionSyncDryRun = (): boolean => {
  const raw = process.env.COLLECTION_SYNC_DRY_RUN;
  if (raw === undefined) return false;

  const value = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  throw new Error(
    `COLLECTION_SYNC_DRY_RUN="${raw}" is not a boolean. Fix it or unset it — ` +
      `refusing to fall back to a live sync.`,
  );
};

/**
 * The Book filter a Collection's sync config describes, or null when the config
 * cannot select anything.
 *
 * Returning null rather than an empty filter is the important part: `{}` would
 * match the entire catalog, so a half-configured collection would swallow every
 * book Commons knows about.
 *
 * The modes are mutually exclusive by design. One rule per collection is what
 * makes "why is this book in here?" answerable by an admin, and what keeps this
 * function a lookup rather than a matrix.
 *
 * `program` can no longer be configured, but it is still matched here: the
 * Collections already on it must keep filling until they are moved to shelves.
 */
export const buildSyncFilter = (
  coll: Pick<
    AutoManagedCollection,
    "syncMode" | "program" | "locations" | "syncShelves"
  >,
): FilterQuery<BookInterface> | null => {
  // Collections configured before sync modes existed carry no `syncMode` and
  // were always program collections.
  const mode: CollectionSyncMode = coll.syncMode ?? "program";

  let rule: FilterQuery<BookInterface> | null = null;

  if (mode === "program") {
    const program = coll.program?.trim();
    const locations = coll.locations ?? [];
    if (program && locations.length > 0) {
      rule = { program, location: { $in: locations } };
    }
  }

  if (mode === "shelves") {
    const shelves = (coll.syncShelves ?? []).filter((s) => s.library && s.path);
    if (shelves.length > 0) {
      rule = {
        $or: shelves.map((shelf) => ({
          library: shelf.library,
          // `(/|$)` is what stops `Bookshelves/Organic_Chemistry` from also
          // matching `Bookshelves/Organic_Chemistry_Lab`.
          shelfPath: {
            $regex: `^${escapeRegExp(shelf.path.replace(/\/+$/, ""))}(/|$)`,
          },
        })),
      };
    }
  }

  if (!rule) return null;

  // A book that has disappeared from its library is on its way out of Commons;
  // re-adding it to a collection every night would undo that.
  return { ...rule, syncMissingSince: { $exists: false } };
};

/**
 * A filter rendered as something you can paste into a Mongo shell.
 *
 * "Why isn't this book in that collection?" is answered by running the
 * collection's own filter against the `books` collection and comparing it to the
 * book's document. `JSON.stringify` turns a RegExp into `{}`, which loses the
 * only interesting part of a keyword filter, so patterns are written out as
 * `/source/flags` literals instead.
 */
export const describeFilter = (filter: FilterQuery<BookInterface>): string =>
  JSON.stringify(filter, (_key, value) =>
    value instanceof RegExp ? `/${value.source}/${value.flags}` : value,
  );

/** A collection's sync rule in one human-readable line, for logs. */
export const describeSyncConfig = (coll: AutoManagedCollection): string => {
  const mode: CollectionSyncMode = coll.syncMode ?? "program";
  if (mode === "shelves") {
    const shelves = (coll.syncShelves ?? []).map(
      (shelf) => `${shelf.library}:${shelf.path}`,
    );
    return `shelves=[${shelves.join(", ")}]`;
  }
  return `program="${coll.program ?? ""}" locations=[${(
    coll.locations ?? []
  ).join(", ")}]`;
};

/** IDs trimmed to something a log line can carry. */
const sampleIDs = (ids: string[]): string[] => ids.slice(0, LOGGED_ID_LIMIT);

/** What a sync would do, or did, to one Collection. */
export type CollectionSyncPlanEntry = {
  collID: string;
  orgID: string;
  title: string;
  syncMode: CollectionSyncMode;
  /** The rule in one line, as {@link describeSyncConfig} renders it. */
  config: string;
  /** The Book filter, as {@link describeFilter} renders it; null if unusable. */
  filter: string | null;
  /** bookIDs the filter selects. Empty when the plan could not be built. */
  matched: string[];
  /** bookIDs currently stored on the collection. */
  existing: string[];
  added: string[];
  removed: string[];
  /** Nested collections, which the reconcile preserves untouched. */
  nested: { resourceType: "resource" | "collection"; resourceID: string }[];
  /** True when the stored book set already equals the match set. */
  unchanged: boolean;
  /** Set when nothing was planned: the config selects nothing, or a query failed. */
  skipReason?: "no-config" | "error";
  error?: string;
};

/** Plans one Collection, logging the decision it reached and why. */
const planForCollection = async (
  coll: AutoManagedCollection,
): Promise<CollectionSyncPlanEntry> => {
  const mode: CollectionSyncMode = coll.syncMode ?? "program";
  const config = describeSyncConfig(coll);
  const existingResources = coll.resources ?? [];
  const nested = existingResources.filter((r) => r.resourceType === "collection");
  const existing = existingResources
    .filter((r) => r.resourceType !== "collection")
    .map((r) => r.resourceID);

  const base = {
    collID: coll.collID,
    orgID: coll.orgID,
    title: coll.title ?? "",
    syncMode: mode,
    config,
    existing,
    nested,
  };

  /* The full membership arrays belong in the returned plan, not in a log line —
     a collection of several thousand books would otherwise write its entire
     contents to CloudWatch on every run, twice. Lines carry counts and a sample. */
  const logBase = {
    collID: base.collID,
    orgID: base.orgID,
    title: base.title,
    syncMode: mode,
    config,
    existingCount: existing.length,
    nestedCount: nested.length,
  };

  collectionSyncLog.debug(
    { ...logBase, existingSample: sampleIDs(existing) },
    `Planning "${base.title || coll.collID}" (${mode}): ${config}`,
  );

  const filter = buildSyncFilter(coll);
  if (!filter) {
    collectionSyncLog.warn(
      logBase,
      `"${base.title || coll.collID}" is auto-managed but its ${mode} config ` +
        `selects nothing (${config}); leaving its books untouched`,
    );
    return {
      ...base,
      filter: null,
      matched: [],
      added: [],
      removed: [],
      unchanged: true,
      skipReason: "no-config",
    };
  }

  const described = describeFilter(filter);

  let matched: string[];
  try {
    const books = await Book.find(filter, { bookID: 1, _id: 0 }).lean();
    matched = books.map((book: { bookID: string }) => book.bookID);
  } catch (err) {
    collectionSyncLog.error(
      { err, ...logBase, filter: described },
      `Could not query books for "${base.title || coll.collID}"`,
    );
    return {
      ...base,
      filter: described,
      matched: [],
      added: [],
      removed: [],
      unchanged: true,
      skipReason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const existingSet = new Set(existing);
  const matchedSet = new Set(matched);
  const added = matched.filter((id) => !existingSet.has(id));
  const removed = existing.filter((id) => !matchedSet.has(id));
  const unchanged = added.length === 0 && removed.length === 0;

  // The filter is logged alongside the counts because it is the one thing that
  // turns "book X is missing from collection Y" into a question you can answer
  // without reading this file: run it against `books` and compare.
  collectionSyncLog.debug(
    {
      ...logBase,
      filter: described,
      matchedCount: matched.length,
      matchedSample: sampleIDs(matched),
      addedCount: added.length,
      added: sampleIDs(added),
      removedCount: removed.length,
      removed: sampleIDs(removed),
      unchanged,
    },
    unchanged
      ? `"${base.title || coll.collID}" already matches its config ` +
          `(${matched.length} book(s)); no write needed`
      : `"${base.title || coll.collID}" will gain ${added.length} and lose ` +
          `${removed.length} book(s) (${matched.length} matched)`,
  );

  if (matched.length === 0) {
    // Almost every "why isn't anything syncing?" report lands here, so it gets a
    // line at a level that is on in production.
    collectionSyncLog.warn(
      { ...logBase, filter: described },
      `"${base.title || coll.collID}" matched no books. Config: ${config}. ` +
        `Filter: ${described}`,
    );
  }

  return {
    ...base,
    filter: described,
    matched,
    added,
    removed,
    unchanged,
  };
};

/**
 * Works out what a sync would do to every auto-managed Collection, writing
 * nothing.
 *
 * Separated from the write so a dry run and a real run reach their conclusions
 * through exactly the same code — a preview that computed its plan differently
 * from the reconcile would be worse than no preview.
 */
export const planCollectionSync = async (): Promise<CollectionSyncPlanEntry[]> => {
  const collections = await Collection.find({ autoManage: true }).lean<
    AutoManagedCollection[]
  >();

  collectionSyncLog.info(
    { collections: collections.length },
    `Planning sync for ${collections.length} auto-managed collection(s)`,
  );

  const plan: CollectionSyncPlanEntry[] = [];
  for (const coll of collections) {
    plan.push(await planForCollection(coll));
  }
  return plan;
};

export type SyncAutoManagedCollectionsOptions = {
  /**
   * Compute and log the plan without writing. Defaults to
   * `COLLECTION_SYNC_DRY_RUN`.
   */
  dryRun?: boolean;
};

/**
 * Brings every auto-managed Collection in line with its sync config.
 *
 * Reconciles rather than appends: a book that no longer matches is removed. The
 * collection's books are system-owned output, so leaving a stale entry behind
 * would make the collection describe a rule it no longer follows, with no way
 * for an admin to tell which entries are current.
 *
 * Nested collections are not sync output and are preserved exactly as stored.
 *
 * One collection's bad config must not cost the rest their sync, so each is
 * planned and written on its own and failures are logged and counted rather than
 * thrown.
 *
 * Every decision is logged at `debug` — which collections were considered, the
 * rule each one carries, the filter it produced, and the books that came and
 * went — because the recurring support question for this feature is "why isn't
 * book X in collection Y?", and the answer is whichever of those steps didn't do
 * what the admin expected. Set `LOG_LEVEL=debug` to see them.
 *
 * @returns The number of Collections whose resources changed (or would change,
 *  under a dry run), or false if the whole pass failed.
 */
export const syncAutoManagedCollections = async (
  options: SyncAutoManagedCollectionsOptions = {},
): Promise<number | false> => {
  let dryRun: boolean;
  let plan: CollectionSyncPlanEntry[];
  try {
    dryRun = options.dryRun ?? isCollectionSyncDryRun();
    if (dryRun) {
      collectionSyncLog.info(
        "DRY RUN — collection membership will be computed and logged but not written.",
      );
    }
    plan = await planCollectionSync();
  } catch (err) {
    collectionSyncLog.error({ err }, "Failed to plan auto-managed collection sync");
    return false;
  }

  let changed = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of plan) {
    if (entry.skipReason) {
      skipped += 1;
      if (entry.skipReason === "error") failed += 1;
      continue;
    }
    if (entry.unchanged) continue;

    const summary = {
      collID: entry.collID,
      title: entry.title,
      syncMode: entry.syncMode,
      config: entry.config,
      matchedCount: entry.matched.length,
      addedCount: entry.added.length,
      added: sampleIDs(entry.added),
      removedCount: entry.removed.length,
      removed: sampleIDs(entry.removed),
      nestedCount: entry.nested.length,
      dryRun,
    };

    if (dryRun) {
      changed += 1;
      collectionSyncLog.info(
        summary,
        `DRY RUN — would reconcile "${entry.title || entry.collID}": ` +
          `+${entry.added.length} / -${entry.removed.length}`,
      );
      continue;
    }

    try {
      await Collection.updateOne(
        { collID: entry.collID, orgID: entry.orgID },
        {
          $set: {
            resources: [
              // Nested collections are not sync output, so they are written back
              // exactly as they were read.
              ...entry.nested.map((r) => ({
                resourceType: r.resourceType,
                resourceID: r.resourceID,
              })),
              ...entry.matched.map((bookID) => ({
                resourceType: "resource" as const,
                resourceID: bookID,
              })),
            ],
          },
        },
      );

      changed += 1;
      collectionSyncLog.info(
        summary,
        `Reconciled "${entry.title || entry.collID}": ` +
          `+${entry.added.length} / -${entry.removed.length}`,
      );
    } catch (err) {
      failed += 1;
      collectionSyncLog.error(
        { err, ...summary },
        `Failed to write "${entry.title || entry.collID}"`,
      );
    }
  }

  collectionSyncLog.info(
    {
      collections: plan.length,
      changed,
      unchanged: plan.filter((e) => !e.skipReason && e.unchanged).length,
      skipped,
      failed,
      dryRun,
    },
    dryRun
      ? `DRY RUN complete — ${changed} of ${plan.length} collection(s) would change.`
      : `Collection sync complete — ${changed} of ${plan.length} collection(s) updated.`,
  );

  if (failed > 0) {
    collectionSyncLog.warn(
      { failed, total: plan.length },
      "Some auto-managed collections could not be synced",
    );
  }

  return changed;
};

export default {
  syncAutoManagedCollections,
  planCollectionSync,
  buildSyncFilter,
  describeFilter,
  describeSyncConfig,
  isCollectionSyncDryRun,
};
