/**
 * Diffs Conductor's Studio API replacements against responses captured from
 * production Studio (the Phase 6 step 8 check in the migration runbook).
 *
 *   node scripts/diff-studio-compat.mjs \
 *     --base http://localhost:5000/api/v1/studio \
 *     --fixtures ../../studio-live-fixtures \
 *     [--identities pseudonymised|real] [--cid 1234] [--changed 2026-10-12] [--show-values]
 *
 * For each captured endpoint it requests the same thing from Conductor and
 * compares the rows present on both sides, key order, and every field. Rows
 * only one side has are counted, not failed: data changes after the capture,
 * and a sampled staging import leaves activities out.
 *
 * `--identities pseudonymised` (the default) compares names, emails and author
 * lists by shape only, because staging replaced them. Use `real` against an
 * environment imported with real identities.
 *
 * Output masks values (letters become "a", digits "9") except ids, codes and
 * dates, because the fixtures hold real names and emails. `--show-values`
 * prints them; use it only in your own terminal.
 *
 * Exits non-zero when a field differs in a way that is not a known, accepted
 * difference (see KNOWN below).
 */
import fs from "node:fs";
import path from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--show-values") args.showValues = true;
  else if (a.startsWith("--")) args[a.slice(2)] = process.argv[++i];
}
if (!args.base || !args.fixtures) {
  console.error("usage: --base <conductor>/api/v1/studio --fixtures <dir> [--identities pseudonymised|real] [--cid N] [--changed YYYY-MM-DD]");
  process.exit(2);
}
const base = args.base.replace(/\/+$/, "");
const identities = args.identities ?? "pseudonymised";

/** Values safe to print: ids, codes, dates, URLs built from ids. */
const SAFE = new Set([
  "id", "h5p_id", "cid", "type_id", "node_id", "adapt_id", "created", "changed", "date_created",
  "license", "license_version", "default_language", "view_node", "url", "count", "uuid", "type",
]);
/** Fields that carry people. Pseudonymised environments replaced these. */
const IDENTITY = new Set(["uid", "authors", "mail", "node_author", "author_name", "h5p_authors"]);
/** Free text a pseudonymised import scrubbed of email addresses. */
const SCRUBBED = new Set(["license_extras", "body", "description", "oer_reference"]);
/**
 * Accepted differences, by endpoint and field, documented in
 * server/api/studio-compat.ts. ADAPT reads none of these fields.
 */
const KNOWN = {
  "*": {
    view_user: "Studio's Drupal user page; Conductor has no Drupal user id",
    thumbnail: "Studio-hosted collection screenshots, not migrated",
  },
  "api/collections/list": {
    tags: "Studio split a collection's tags across repeated rows; ADAPT keeps the first row",
    subject: "Studio split a collection's subjects across repeated rows; ADAPT keeps the first row",
    count: "Studio counted references to activities whose content was deleted; the import drops them",
  },
};

const mask = (v) =>
  typeof v !== "string"
    ? JSON.stringify(v)
    : JSON.stringify(v.replace(/[A-Za-zÀ-ɏ]/g, "a").replace(/[0-9]/g, "9").replace(/a+/g, "a").replace(/9+/g, "9").slice(0, 60));
const show = (key, v) => (args.showValues || SAFE.has(key) ? JSON.stringify(v) : mask(v));
const shapeOf = (v) => (typeof v === "string" ? v.replace(/[^\s&;#<>/":,=\[\]{}@.-]/g, "x").replace(/x+/g, "x") : typeof v);

function readFixture(name) {
  const file = path.join(args.fixtures, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

async function get(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

let unexpected = 0;

function compareRows(label, keyOf, fixtureRows, conductorRows, endpoint = label) {
  console.log(`\n== ${label}`);
  const theirs = new Map(fixtureRows.map((r) => [keyOf(r), r]));
  const ours = new Map(conductorRows.map((r) => [keyOf(r), r]));
  const both = [...theirs.keys()].filter((k) => ours.has(k));
  console.log(`  rows: Studio ${fixtureRows.length}, Conductor ${conductorRows.length}, compared ${both.length}`);
  console.log(`  only in Studio's capture: ${[...theirs.keys()].filter((k) => !ours.has(k)).length}   only in Conductor: ${[...ours.keys()].filter((k) => !theirs.has(k)).length}`);
  if (!both.length) {
    console.log("  nothing to compare");
    return;
  }

  const studioKeys = Object.keys(fixtureRows[0]);
  const ourKeys = Object.keys(conductorRows[0] ?? {});
  const orderOK = JSON.stringify(studioKeys) === JSON.stringify(ourKeys);
  console.log(`  key order: ${orderOK ? "identical" : "DIFFERENT"}`);
  if (!orderOK) {
    unexpected++;
    console.log(`    Studio:    ${studioKeys.join(",")}`);
    console.log(`    Conductor: ${ourKeys.join(",")}`);
  }

  for (const key of studioKeys) {
    let diff = 0;
    const examples = [];
    for (const k of both) {
      const a = theirs.get(k)[key];
      const b = ours.get(k)[key];
      const same =
        identities === "pseudonymised" && IDENTITY.has(key)
          ? shapeOf(a).length > 0 === shapeOf(b).length > 0 && typeof a === typeof b
          : identities === "pseudonymised" && SCRUBBED.has(key)
            ? a.replace(/[^\s@]+@[^\s@]+/g, "") .length > 0 === b.length > 0
            : a === b;
      if (!same) {
        diff++;
        if (examples.length < 3) examples.push(`${k}: Studio ${show(key, a)} | Conductor ${show(key, b)}`);
      }
    }
    if (!diff) continue;
    const pseudonymOnly =
      identities === "pseudonymised" && IDENTITY.has(key)
        ? "an owner the pseudonymised data cannot resolve; check against real identities"
        : undefined;
    const known = KNOWN[endpoint]?.[key] ?? KNOWN["*"][key] ?? pseudonymOnly;
    if (!known) unexpected++;
    console.log(`  ${known ? "known" : "DIFF "} ${key}: ${diff} of ${both.length}${known ? ` (${known})` : ""}`);
    if (!known) examples.forEach((e) => console.log(`         ${e}`));
  }
}

// ---------------------------------------------------------------- h5p/{id}
const byId = readFixture("h5p-by-id.json");
if (byId) {
  const rows = [];
  for (const r of byId) {
    const { body } = await get(`${base}/h5p/${r.id}`);
    if (Array.isArray(body)) rows.push(...body);
  }
  compareRows("api/h5p/{id}", (r) => r.id, byId, rows);
}

// ---------------------------------------------------------------- h5p/all
const all = readFixture("h5p-all.json");
if (all) {
  // The capture's date is not recorded. Default to the oldest change in it,
  // as a US Eastern date, so Conductor's window covers every captured row.
  let changed = args.changed;
  if (!changed) {
    const oldest = all
      .map((r) => r.changed.match(/^(\d+)\/(\d+)\/(\d+) - (\d+):(\d+)$/))
      .filter(Boolean)
      .map((m) => Date.UTC(+m[3], m[1] - 1, +m[2], +m[4], +m[5]))
      .sort((a, b) => a - b)[0];
    changed = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(oldest));
  }
  const { status, body } = await get(`${base}/h5p/all?changed=${changed}`);
  console.log(`\n(api/h5p/all requested with changed=${changed}, status ${status}, ${Array.isArray(body) ? body.length : "no"} rows; the cap is 100)`);
  compareRows("api/h5p/all", (r) => r.id, all, Array.isArray(body) ? body : []);
}

// ---------------------------------------------------------------- collections/list
const list = readFixture("collection-list.json");
let listBody = [];
if (list) {
  const { body } = await get(`${base}/collections/list`);
  listBody = Array.isArray(body) ? body : [];
  // Studio repeated collections; compare its first row per cid, which is
  // also what ADAPT keeps.
  const firstPerCid = [];
  const seen = new Set();
  for (const r of list) if (!seen.has(r.cid)) { seen.add(r.cid); firstPerCid.push(r); }
  compareRows("api/collections/list (first row per cid)", (r) => r.cid, firstPerCid, listBody, "api/collections/list");
  const ourCids = listBody.map((r) => r.cid);
  console.log(`  repeated cids in Conductor's list: ${ourCids.length - new Set(ourCids).size}`);
}

// ---------------------------------------------------------------- collections/{cid}
const byCid = readFixture("collection-by-cid.json");
if (byCid) {
  let cid = args.cid;
  if (!cid && list) {
    // Studio's list counted each collection's activity references.
    const candidates = [...new Set(list.filter((r) => Number(r.count) === byCid.length).map((r) => r.cid))];
    if (candidates.length === 1) cid = candidates[0];
  }
  if (!cid) {
    console.log("\n== api/collections/{cid}\n  skipped: pass --cid with the collection id the capture was taken for");
  } else {
    const { body } = await get(`${base}/collections/${cid}`);
    const rows = Array.isArray(body) ? body : [];
    // Rows repeat an activity when it appears twice; key by position within
    // its sub-collection so repeats line up.
    const keyed = (rs) => {
      const pos = new Map();
      return rs.map((r) => {
        const k = `${r.subcollection_title}#${r.h5p_id}`;
        const n = (pos.get(k) ?? 0) + 1;
        pos.set(k, n);
        return { ...r, __key: `${k}#${n}` };
      });
    };
    const theirs = keyed(byCid);
    const ours = keyed(rows);
    console.log(`\n(api/collections/${cid})`);
    compareRows("api/collections/{cid}", (r) => r.__key, theirs.map(({ __key, ...r }) => Object.assign(r, { __key })), ours);
    const order = (rs) => rs.map((r) => `${r.subcollection_title}#${r.h5p_id}`).join("|");
    const shared = new Set(ours.map((r) => r.__key));
    const studioOrder = order(byCid.filter((r, i) => shared.has(theirs[i].__key)));
    const ourOrder = order(rows.filter((r, i) => theirs.some((t) => t.__key === ours[i].__key)));
    const sameOrder = studioOrder === ourOrder;
    if (!sameOrder) unexpected++;
    console.log(`  row order of shared rows: ${sameOrder ? "identical" : "DIFFERENT"}`);
  }
}

console.log(unexpected ? `\n${unexpected} unexpected difference(s).` : "\nNo unexpected differences.");
process.exitCode = unexpected ? 1 : 0;
