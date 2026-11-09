import { readFileSync } from "fs";
import { createInterface } from "readline/promises";
import { childLogger } from "../logger.js";
import { generateAPIRequestHeaders, getPage } from "../util/librariesclient.js";

/**
 * One-off repair for a book broken by the remixer's `?title=` path bug.
 *
 * Renaming a book root to a slug containing `&` makes MindTouch report its
 * uri.ui in query form (`https://<lib>.libretexts.org/?title=Workbench/…`).
 * The remixer took that string for a path, so every page it then moved or
 * created landed in a fake top-level tree named `?title=Workbench/…`. Each
 * depth level adds one more `?title=` prefix, so units, chapters, sections and
 * subsections ended up in *separate* fake trees under blank placeholder
 * parents, and the real parent/child links were lost.
 *
 * The saved remixer book still has the intended structure (`parentID`) and the
 * intended leaf slug (last segment of each `uri.ui`). This script rebuilds
 * each page's correct path from that and moves the page there by page ID,
 * parents first. A page already at its target path is skipped, so pages
 * recovered by hand to the same path are left alone and the script is safe to
 * re-run.
 *
 * It only moves pages. It never deletes. At the end it reports the fake
 * `?title=…` root pages that are left, for manual review and deletion.
 *
 * Usage (from server/, with AWS credentials for the library token in env):
 *   npx tsx migrations/RepairRemixerQueryTitlePaths.ts <export.json> [--apply]
 *     [--subdomain=human] [--root-path=Workbench/<slug>]
 *
 * <export.json> is a mongoexport of the project's ProjectRemixer documents;
 * the non-archived one is used. Without --apply nothing is changed. With
 * --apply each move is shown and must be confirmed: [y]es, [n]o (skip),
 * [a]ll remaining, [q]uit.
 */

const log = childLogger("remixer-repair");

type SnapshotPage = {
  "@id": string;
  "@title"?: string;
  title?: string;
  parentID?: string;
  "uri.ui"?: string;
  uri?: { ui?: string };
  deletedItem?: boolean;
};

type RemixerDoc = {
  archived?: boolean;
  remixerCurrentBook: SnapshotPage[];
};

const DEFAULT_ROOT_PATH =
  "Workbench/ESL_Support_for_ENGL_C1000_Academic_Reading__Writing";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const flag = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  if (!file) {
    throw new Error(
      "Usage: RepairRemixerQueryTitlePaths.ts <export.json> [--apply] [--subdomain=human] [--root-path=Workbench/<slug>]",
    );
  }
  return {
    file,
    apply: args.includes("--apply"),
    subdomain: flag("subdomain") ?? "human",
    rootPath: flag("root-path") ?? DEFAULT_ROOT_PATH,
  };
};

const uriOf = (page: SnapshotPage): string =>
  page["uri.ui"] || page.uri?.ui || "";

/** Last path segment of a uri.ui, decoded once (`00%3A_Front_Matter` → `00:_Front_Matter`). */
const leafOf = (page: SnapshotPage): string => {
  const raw = uriOf(page).split("/").pop() ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** MindTouch page info returns `path` as a string or as `{ "#text": … }`. */
const pathOf = (info: any): string | null => {
  const p = info?.path;
  if (typeof p === "string") return p;
  if (p && typeof p["#text"] === "string") return p["#text"];
  return null;
};

const movePage = async (
  pageID: string,
  targetPath: string,
  subdomain: string,
): Promise<void> => {
  const headers = await generateAPIRequestHeaders(subdomain);
  if (!headers) throw new Error("Could not generate library API headers");
  // MindTouch decodes `to` twice (HTTP layer, then the Deki router).
  const toEnc = encodeURIComponent(encodeURIComponent(targetPath));
  const url = `https://${subdomain}.libretexts.org/@api/deki/pages/${pageID}/move?to=${toEnc}&allow=deleteredirects&dream.out.format=json`;
  const res = await fetch(url, {
    method: "POST",
    body: "",
    headers: { "Content-Type": "text/plain", ...headers },
  });
  if (!res.ok) {
    throw new Error(`move failed: ${res.status} ${res.statusText}`);
  }
};

export async function runRepair() {
  const { file, apply, subdomain, rootPath } = parseArgs();
  const docs: RemixerDoc[] = JSON.parse(readFileSync(file, "utf-8"));
  const doc = docs.find((d) => d.archived !== true);
  if (!doc) throw new Error("No non-archived remixer document in export");

  const pages = doc.remixerCurrentBook.filter(
    (p) => p.deletedItem !== true && /^\d+$/.test(p["@id"]),
  );
  const byId = new Map(pages.map((p) => [p["@id"], p]));
  const root = pages.find((p) => !p.parentID || p.parentID === "-1");
  if (!root) throw new Error("No book root (parentID -1) in snapshot");

  // Target path for every page, built top-down from the intended tree.
  const targetById = new Map<string, string>();
  const depthById = new Map<string, number>();
  const resolve = (page: SnapshotPage, seen = new Set<string>()): string => {
    const id = page["@id"];
    const cached = targetById.get(id);
    if (cached) return cached;
    if (page === root) {
      targetById.set(id, rootPath);
      depthById.set(id, 0);
      return rootPath;
    }
    if (seen.has(id)) throw new Error(`Parent cycle at page ${id}`);
    seen.add(id);
    const parent = byId.get(page.parentID ?? "");
    if (!parent) {
      throw new Error(`Page ${id} has parent ${page.parentID} missing from snapshot`);
    }
    const target = `${resolve(parent, seen)}/${leafOf(page)}`;
    targetById.set(id, target);
    depthById.set(id, (depthById.get(parent["@id"]) ?? 0) + 1);
    return target;
  };
  pages.forEach((p) => resolve(p));

  const ordered = [...pages].sort(
    (a, b) => depthById.get(a["@id"])! - depthById.get(b["@id"])!,
  );

  log.info(
    { pages: ordered.length, subdomain, rootPath, apply },
    apply ? "Repairing book paths" : "Dry run: no pages will be moved",
  );

  let moved = 0;
  let alreadyOk = 0;
  let skipped = 0;
  const failed: string[] = [];

  // Each move is confirmed interactively unless the operator answers "a".
  const rl = apply
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;
  let confirmAll = false;
  let quit = false;
  const confirmMove = async (
    id: string,
    title: string,
    from: string,
    to: string,
  ): Promise<boolean> => {
    if (confirmAll) return true;
    for (;;) {
      const answer = (
        await rl!.question(
          `\nPage ${id} "${title}"\n  from: ${from}\n  to:   ${to}\nMove? [y]es / [n]o / [a]ll remaining / [q]uit: `,
        )
      )
        .trim()
        .toLowerCase();
      if (answer === "y" || answer === "yes") return true;
      if (answer === "n" || answer === "no") return false;
      if (answer === "a" || answer === "all") {
        confirmAll = true;
        return true;
      }
      if (answer === "q" || answer === "quit") {
        quit = true;
        return false;
      }
    }
  };

  for (const page of ordered) {
    if (quit) break;
    const id = page["@id"];
    const target = targetById.get(id)!;
    const title = page["@title"] || page.title || "";
    // Read the live path right before each move: an earlier move in this run
    // (or a manual recovery) may already have put this page in place.
    const info = await getPage(Number(id), subdomain);
    const current = pathOf(info);
    if (!info || current === null) {
      log.warn({ id, title }, "Page not found in library; skipping");
      failed.push(id);
      continue;
    }
    if (current === target) {
      alreadyOk += 1;
      continue;
    }
    if (!apply) {
      log.info({ id, title, from: current, to: target }, "Would move");
      continue;
    }
    if (!(await confirmMove(id, title, current, target))) {
      if (!quit) {
        log.info({ id, title }, "Skipped by operator");
        skipped += 1;
      }
      continue;
    }
    log.info({ id, title, from: current, to: target }, "Moving");
    try {
      await movePage(id, target, subdomain);
      moved += 1;
    } catch (err) {
      log.error({ err, id, title, to: target }, "Move failed");
      failed.push(id);
    }
  }
  rl?.close();
  if (quit) log.warn("Stopped by operator; remaining pages were not processed");

  // Fake roots left behind: `?title=Workbench`, `?title=?title=Workbench`, …
  const leftovers: string[] = [];
  const topSegment = rootPath.split("/")[0];
  for (let depth = 1; depth <= 8; depth += 1) {
    const fakeRoot = `${"?title=".repeat(depth)}${topSegment}`;
    const info = await getPage(fakeRoot, subdomain);
    if (info?.["@id"]) {
      leftovers.push(`${info["@id"]} ${fakeRoot}`);
    }
  }

  log.info(
    { moved, alreadyOk, skipped, failed, leftoverFakeRoots: leftovers },
    apply
      ? "Repair finished. Review each leftover fake root's subtree in the library and delete it once it holds only blank placeholder pages."
      : "Dry run finished. Re-run with --apply to move the pages listed above.",
  );
}

// Run standalone (from server/):
//   npx tsx migrations/RepairRemixerQueryTitlePaths.ts <export.json> [--apply]
// runRepair()
//   .then(() => process.exit(0))
//   .catch((err) => {
//     log.fatal({ err }, "Repair failed");
//     process.exit(1);
//   });
