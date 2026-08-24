/**
 * removeCoverpageTags.ts
 *
 * Rarely-run CLI tool that strips the `coverpage:yes` tag from a set of CXOne
 * (MindTouch) library pages listed in a JSON file.
 *
 * CXOne has no "delete a single tag" endpoint: `PUT /pages/{id}/tags` replaces
 * the page's entire tag set. So for each page this reads the current tags with
 * `getPageTags`, drops `coverpage:yes`, and PUTs the remaining tags back as an
 * `application/xml` `<tags>` document. Pages that don't carry the tag are logged
 * and left alone (no request is sent), so the script is idempotent and safe to
 * re-run over the same input. Because every PUT is a full replacement, a page
 * whose tags can't be read cleanly is failed rather than written.
 *
 * Input file: a JSON array of objects, of which only two fields are used:
 *   - `libreLibrary`  -> the library subdomain handed to ExpertWithSSM.forLibrary()
 *   - `libreCoverID`  -> the page id handed to the SDK's `pages.*` methods
 *
 *   [
 *     {
 *       "_id": { "$oid": "6a8952c9ee57d23bd1cd6b90" },
 *       "orgID": "libretexts",
 *       "projectID": "MfxcGJszbH",
 *       "title": "1.1: Binary operations",
 *       "libreLibrary": "math",
 *       "libreCoverID": "7419",
 *       "projectURL": "https://math.libretexts.org/...",
 *       "createdAt": { "$date": "2026-08-22T07:42:02.010Z" }
 *     }
 *   ]
 *
 * Usage (from server/):
 *   npx tsx scripts/removeCoverpageTags.ts [inputFile] [--limit N] [--apply]
 *
 * Defaults are the editable consts below. The script is DRY RUN by default: it
 * reads tags and prints the payload it would send without writing anything.
 * Pass `--apply` (or flip `DRY_RUN`) to actually PUT. Start with a small
 * `--limit` to eyeball a few pages before running the whole batch.
 *
 * Credentials resolve exactly as they do in the server: ExpertWithSSM pulls the
 * per-library key/secret pair from AWS SSM Parameter Store, so this needs the
 * usual AWS chain (env / shared config) plus AWS_REGION,
 * AWS_SSM_LIB_TOKEN_PAIR_PATH and LIBRARIES_API_USERNAME. `.env` is loaded.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import Expert from "../util/ExpertWithSSM.js";
import type { PageTag, Tags } from "@libretexts/cxone-expert-node";
import { mapWithConcurrency } from "../util/concurrency.js";

// ---------------------------------------------------------------------------
// Knobs
// ---------------------------------------------------------------------------

/** Path to the JSON export. Relative paths resolve from the CWD. */
const INPUT_FILE = "./coverpages.json";

/**
 * Process at most this many pages. Keep it small (e.g. 5) for a correctness
 * check, then set `Infinity` (or pass `--limit 0`) for the full batch.
 */
const LIMIT: number = 5;

/** When true, log what would be written but send no PUT requests. */
const DRY_RUN: boolean = true;

/** Max pages in flight at once. Keep this low — it is one host per library. */
const CONCURRENCY = 3;

/** The tag to unset. */
const TARGET_TAG = "coverpage:yes";

// ---------------------------------------------------------------------------

type CoverpageRecord = {
    libreLibrary?: string;
    libreCoverID?: string;
    title?: string;
    projectID?: string;
};

type PageRef = {
    library: string;
    coverID: string;
    /** Only for log lines. */
    title: string;
};

type Outcome =
    | { status: "updated"; ref: PageRef; kept: string[] }
    | { status: "dry-run"; ref: PageRef; kept: string[]; payload: string }
    | { status: "not-tagged"; ref: PageRef }
    | { status: "failed"; ref: PageRef; error: string };

/** CXOne returns repeated elements as object | array | "" depending on cardinality. */
function toArray<T>(value: T | T[] | "" | undefined | null): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Tag values from a `GET /pages/{id}/tags` response, in the order returned.
 *
 * Because `PUT /pages/{id}/tags` replaces the whole set, a tag we fail to read
 * is a tag we would silently delete. Anything without a usable `@value` is
 * therefore reported instead of dropped, and the caller aborts the page.
 */
function tagValues(tags: Partial<Tags> | undefined): {
    values: string[];
    unreadable: number;
} {
    const entries = toArray<Partial<PageTag> | "">(tags?.tag);
    const values: string[] = [];
    let unreadable = 0;

    for (const entry of entries) {
        const value = entry ? entry["@value"] : undefined;
        if (typeof value === "string" && value.length) {
            if (!values.includes(value)) values.push(value);
        } else {
            unreadable++;
        }
    }

    return { values, unreadable };
}

/**
 * Escapes a tag value for use inside a double-quoted XML attribute. `&` must go
 * first so the ampersands introduced by the later replacements are not escaped
 * a second time. `'` needs no escaping inside double quotes.
 */
function escapeXmlAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Builds the `<tags><tag value="..." /></tags>` document CXOne expects, sent as
 * `application/xml`. An empty list yields `<tags />`, which clears the page's
 * tags.
 */
function buildTagsPayload(values: string[]): string {
    if (!values.length) return "<tags />";
    const tags = values
        .map((value) => `<tag value="${escapeXmlAttr(value)}" />`)
        .join("");
    return `<tags>${tags}</tags>`;
}

/**
 * Reads the input file and returns the pages worth visiting: rows missing a
 * library or cover id are dropped, and repeat (library, coverID) pairs are
 * collapsed so a page is never PUT twice in one run.
 */
async function loadPageRefs(filePath: string): Promise<PageRef[]> {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Expected ${filePath} to contain a JSON array.`);
    }

    const refs: PageRef[] = [];
    const seen = new Set<string>();
    let malformed = 0;
    let duplicates = 0;

    for (const record of parsed as CoverpageRecord[]) {
        const library = record?.libreLibrary?.trim();
        const coverID = record?.libreCoverID?.toString().trim();
        if (!library || !coverID) {
            malformed++;
            continue;
        }

        const key = `${library}:${coverID}`;
        if (seen.has(key)) {
            duplicates++;
            continue;
        }
        seen.add(key);

        refs.push({
            library,
            coverID,
            title: record?.title?.trim() || "(untitled)",
        });
    }

    console.log(
        `Loaded ${parsed.length} record(s) from ${filePath}: ${refs.length} unique page(s)` +
        `${duplicates ? `, ${duplicates} duplicate(s) collapsed` : ""}` +
        `${malformed ? `, ${malformed} skipped for a missing library/cover id` : ""}.`
    );

    return refs;
}

/** Reads a page's tags, drops {@link TARGET_TAG}, and writes the rest back. */
async function untagPage(ref: PageRef, dryRun: boolean): Promise<Outcome> {
    const label = `${ref.library}/${ref.coverID} "${ref.title}"`;

    try {
        const expert = await Expert.getInstance().forLibrary(ref.library);
        const current = tagValues(await expert.pages.getPageTags(ref.coverID));

        // A PUT replaces the whole set, so refuse to write a set we could not
        // fully read — that would delete the tags we failed to parse.
        if (current.unreadable) {
            throw new Error(
                `${current.unreadable} tag(s) had no readable "@value"; refusing to ` +
                `PUT a set that would drop them.`
            );
        }

        if (!current.values.includes(TARGET_TAG)) {
            console.log(`- ${label}: not tagged ${TARGET_TAG}, nothing to do.`);
            return { status: "not-tagged", ref };
        }

        const kept = current.values.filter((value) => value !== TARGET_TAG);
        const payload = buildTagsPayload(kept);

        if (dryRun) {
            console.log(`- ${label}: would PUT ${payload}`);
            return { status: "dry-run", ref, kept, payload };
        }

        // The SDK's request client hard-defaults `Content-Type: application/json`
        // and `putPageTags` sets no type of its own, so the XML body would go out
        // mislabelled. `funcArgs.headers` is merged over the client defaults, which
        // is the only hook for correcting it. Axios leaves a string body untouched,
        // so `payload` is sent verbatim. The `dream.out.format=json` query param the
        // client always sends is unaffected — the response still comes back as JSON.
        const updated = await expert.pages.putPageTags(
            ref.coverID,
            payload,
            undefined,
            { headers: { "Content-Type": "application/xml" } }
        );

        // CXOne echoes the new tag set back. Treat the tag still being present, or
        // a kept tag having gone missing, as a failure rather than reporting a
        // write that didn't take.
        const after = tagValues(updated);
        if (after.values.includes(TARGET_TAG)) {
            throw new Error(
                `${TARGET_TAG} still present after PUT (got: ${after.values.join(", ") || "none"})`
            );
        }
        const lost = kept.filter((value) => !after.values.includes(value));
        if (lost.length) {
            throw new Error(
                `PUT dropped tag(s) that should have been kept: ${lost.join(", ")}`
            );
        }

        console.log(
            `- ${label}: removed ${TARGET_TAG}, ${kept.length} tag(s) remain.`
        );
        return { status: "updated", ref, kept };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`- ${label}: FAILED — ${error}`);
        return { status: "failed", ref, error };
    }
}

function parseArgs(argv: string[]): {
    inputFile: string;
    limit: number;
    dryRun: boolean;
} {
    let inputFile = INPUT_FILE;
    let limit = LIMIT;
    let dryRun = DRY_RUN;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--apply") {
            dryRun = false;
        } else if (arg === "--dry-run") {
            dryRun = true;
        } else if (arg === "--limit") {
            const value = Number(argv[++i]);
            if (!Number.isFinite(value) || value < 0) {
                throw new Error("--limit expects a non-negative number (0 = no limit).");
            }
            limit = value === 0 ? Infinity : value;
        } else if (arg.startsWith("--")) {
            throw new Error(`Unknown flag: ${arg}`);
        } else {
            inputFile = arg;
        }
    }

    return { inputFile, limit, dryRun };
}

async function main() {
    const { inputFile, limit, dryRun } = parseArgs(process.argv.slice(2));
    const resolved = path.resolve(process.cwd(), inputFile);

    const all = await loadPageRefs(resolved);
    const refs = Number.isFinite(limit) ? all.slice(0, limit) : all;

    if (refs.length < all.length) {
        console.log(
            `Limited to the first ${refs.length} of ${all.length} page(s). Pass "--limit 0" for the full batch.`
        );
    }
    if (!refs.length) {
        console.log("Nothing to do.");
        return;
    }

    console.log(
        `${dryRun ? "DRY RUN" : "APPLYING"}: removing "${TARGET_TAG}" from ` +
        `${refs.length} page(s) at concurrency ${CONCURRENCY}.` +
        `${dryRun ? ' Pass "--apply" to write.' : ""}`
    );

    const outcomes = await mapWithConcurrency(refs, CONCURRENCY, (ref) =>
        untagPage(ref, dryRun)
    );

    const tally = (status: Outcome["status"]) =>
        outcomes.filter((outcome) => outcome.status === status).length;

    console.log(
        `\nDone. updated: ${tally("updated")}, would-update: ${tally("dry-run")}, ` +
        `not-tagged: ${tally("not-tagged")}, failed: ${tally("failed")}.`
    );

    const failures = outcomes.filter(
        (outcome): outcome is Extract<Outcome, { status: "failed" }> =>
            outcome.status === "failed"
    );
    if (failures.length) {
        console.log("\nFailed pages (safe to re-run — this script is idempotent):");
        for (const failure of failures) {
            console.log(
                `  ${failure.ref.library}/${failure.ref.coverID} — ${failure.error}`
            );
        }
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
