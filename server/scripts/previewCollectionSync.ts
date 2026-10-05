/**
 * previewCollectionSync.ts
 *
 * Prints what a collection sync WOULD do, without writing anything.
 *
 * Auto-managed Collections are reconciled during the Commons-Libraries sync:
 * books that match the collection's rule are added, books that no longer match
 * are removed. This script runs only the planning half of that — the same code
 * path the real sync uses — so you can check a new keyword or shelf config
 * against real data before letting it rewrite a collection's membership.
 *
 * For each auto-managed Collection it reports the rule, the Mongo filter that
 * rule compiles to, how many books match, and which books would be added and
 * removed. The filter is printed verbatim so you can paste it into a Mongo shell
 * next to the book someone says is missing and see which clause rejects it.
 *
 * Usage (from server/):
 *   npx tsx scripts/previewCollectionSync.ts [--limit N] [--coll COLLID] [--verbose]
 *
 *   --limit N      Show at most N books per added/removed list (default 25; 0 = all)
 *   --coll COLLID  Only report this collection
 *   --verbose      Also list every matched bookID (never capped by --limit)
 *
 * Reads `MONGOOSEURI` from `.env`. It opens no library connections, issues no
 * writes, and connects with index and collection auto-creation disabled, so it
 * is safe to run against any environment — including production, if you need to
 * answer "what does this collection think it should contain?".
 *
 * To withhold the writes from a real sync run instead (so the nightly job plans
 * and logs but changes nothing), set `COLLECTION_SYNC_DRY_RUN=true` and watch the
 * `collection-sync` logs at `LOG_LEVEL=debug`.
 */

import "dotenv/config";
import mongoose from "mongoose";
import logger from "../logger.js";
import {
  planCollectionSync,
  type CollectionSyncPlanEntry,
} from "../api/services/collection-sync-service.js";

/** Default number of bookIDs printed per added/removed list. */
const DEFAULT_LIMIT = 25;

type Args = {
  limit: number;
  collID?: string;
  verbose: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: DEFAULT_LIMIT, verbose: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--limit") {
      const raw = argv[i + 1];
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`--limit needs a non-negative integer, got "${raw}".`);
      }
      // 0 means "no cap"; Infinity is what slice() wants for that.
      args.limit = value === 0 ? Infinity : value;
      i += 1;
    } else if (arg === "--coll") {
      args.collID = argv[i + 1];
      if (!args.collID) throw new Error("--coll needs a collection ID.");
      i += 1;
    } else {
      throw new Error(`Unrecognized argument "${arg}".`);
    }
  }

  return args;
}

/** One collection's plan, as a block of printable lines. */
function render(entry: CollectionSyncPlanEntry, args: Args): string[] {
  const label = entry.title ? `${entry.title} (${entry.collID})` : entry.collID;
  const lines = [
    "",
    `=== ${label} ===`,
    `  mode:     ${entry.syncMode}`,
    `  config:   ${entry.config}`,
    `  filter:   ${entry.filter ?? "(none — config selects nothing)"}`,
  ];

  if (entry.skipReason === "no-config") {
    lines.push("  verdict:  SKIPPED — incomplete config, books left untouched");
    return lines;
  }
  if (entry.skipReason === "error") {
    lines.push(`  verdict:  FAILED — ${entry.error ?? "unknown error"}`);
    return lines;
  }

  lines.push(
    `  matched:  ${entry.matched.length} book(s)`,
    `  stored:   ${entry.existing.length} book(s), ${entry.nested.length} nested collection(s)`,
  );

  if (entry.unchanged) {
    lines.push("  verdict:  no change");
  } else {
    lines.push(
      `  verdict:  +${entry.added.length} / -${entry.removed.length}`,
    );
    if (entry.added.length > 0) {
      lines.push(`  add:      ${listIDs(entry.added, args.limit)}`);
    }
    if (entry.removed.length > 0) {
      lines.push(`  remove:   ${listIDs(entry.removed, args.limit)}`);
    }
  }

  // `--limit` trims the add/remove lists to something readable. `--verbose` asks
  // for the whole match set, so it is never capped — a truncated "all matched"
  // would be the one list in this output you cannot trust.
  if (args.verbose && entry.matched.length > 0) {
    lines.push(`  all matched: ${listIDs(entry.matched, Infinity)}`);
  }

  return lines;
}

function listIDs(ids: string[], limit: number): string {
  const shown = ids.slice(0, limit);
  const suffix = ids.length > shown.length ? ` … +${ids.length - shown.length} more` : "";
  return shown.join(", ") + suffix;
}

export async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.MONGOOSEURI) {
    throw new Error("MONGOOSEURI environment variable is not set.");
  }

  /* `autoIndex`/`autoCreate` are off because this script claims to be safe
     against production. Importing the sync service registers the Book model
     along with its `{ library, shelfPath }` index, and Mongoose's defaults would
     build that index — a write, and a slow one — on the first query. */
  await mongoose.connect(process.env.MONGOOSEURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: false,
    autoCreate: false,
  } as mongoose.ConnectOptions);

  try {
    const plan = await planCollectionSync();
    const entries = args.collID
      ? plan.filter((entry) => entry.collID === args.collID)
      : plan;

    if (args.collID && entries.length === 0) {
      logger.warn(
        `No auto-managed collection with collID "${args.collID}". ` +
          `Is it auto-managed, and is this the right database?`,
      );
      return;
    }

    const lines: string[] = [];
    for (const entry of entries) lines.push(...render(entry, args));

    const changing = entries.filter((e) => !e.skipReason && !e.unchanged);
    const added = changing.reduce((sum, e) => sum + e.added.length, 0);
    const removed = changing.reduce((sum, e) => sum + e.removed.length, 0);

    lines.push(
      "",
      "=== Summary ===",
      `  collections:  ${entries.length}`,
      `  would change: ${changing.length}`,
      `  books added:  ${added}`,
      `  books removed: ${removed}`,
      `  skipped:      ${entries.filter((e) => e.skipReason === "no-config").length}`,
      `  failed:       ${entries.filter((e) => e.skipReason === "error").length}`,
      "",
      "DRY RUN — nothing was written.",
    );

    logger.info(lines.join("\n"));
  } finally {
    await mongoose.disconnect();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "previewCollectionSync failed");
    process.exit(1);
  });
