/**
 * Settles how restrictions should be sourced for a book's TOC.
 *
 * `/pages/{id}/find` needs a constraint (a bare call 400s with
 * FindPagesMissingConstraintsException), and it is not documented whether a
 * given constraint narrows the result set. This measures coverage against the
 * page tree for each candidate, so the answer comes from the library rather
 * than from a guess:
 *
 *   - how many of the book's pages each constraint reports a restriction for
 *   - whether the tree carries `security` when asked for it directly
 *   - which pages the filtered TOC would currently drop
 *
 * Copy it into `server/` and run it from there, so it picks up that package's
 * .env and node_modules:
 *   cp <this file> server/probe-restrictions.ts
 *   cd server && npx tsx probe-restrictions.ts med-116064
 * Delete it afterwards; it is a throwaway, not part of the codebase.
 */
import "dotenv/config";
import ExpertWithSSM from "./util/ExpertWithSSM.js";
import {
  pageRestriction,
  isPubliclyListable,
} from "./util/CXOne/page-restriction.js";
import { many, one } from "@libretexts/cxone-expert-node";

const bookID = process.argv[2];
if (!bookID) {
  console.error("usage: npx tsx probe-restrictions.ts <library>-<coverID>");
  process.exit(1);
}

const [library, coverID] = bookID.split("-");

/** Candidate constraints, cheapest first. `find` rejects an empty one. */
const CANDIDATES: { label: string; params: Record<string, string> }[] = [
  { label: "tags=article:topic", params: { tags: "article:topic" } },
  { label: "tags=article:topic-category", params: { tags: "article:topic-category" } },
  { label: "tags=coverpage:yes", params: { tags: "coverpage:yes" } },
  { label: "since=19700101000000", params: { since: "19700101000000" } },
  { label: "since=1970-01-01T00:00:00Z", params: { since: "1970-01-01T00:00:00Z" } },
  { label: "(no constraint)", params: {} },
];

const treeIDs = (node: any, out: string[] = []): string[] => {
  out.push(String(node["@id"]));
  for (const child of many<any>(node.subpages?.page)) treeIDs(child, out);
  return out;
};

const main = async () => {
  const expert = await ExpertWithSSM.getInstance().forLibrary(library);

  // The tree is the authority on which pages are in the book, so it is the
  // denominator every candidate is scored against.
  const tree = await expert.pages.getPageTree(parseInt(coverID), {
    include: "properties,lastmodified",
  });
  const root = one(tree?.page as any);
  const allIDs = treeIDs(root);
  console.log(`tree: ${allIDs.length} pages under ${bookID}\n`);

  // Does the tree carry security when asked? If so, the whole find/backfill
  // path can be deleted in favor of one request.
  for (const include of ["security", "properties,lastmodified,security"]) {
    try {
      const t = await expert.pages.getPageTree(parseInt(coverID), { include });
      const r: any = one(t?.page as any);
      console.log(
        `tree include=${include}: security on root = ${JSON.stringify(r?.security ?? null)}`,
      );
    } catch (err: any) {
      console.log(`tree include=${include}: FAILED ${err?.message ?? err}`);
    }
  }
  console.log("");

  let best: { label: string; byID: Map<string, string> } | null = null;

  for (const { label, params } of CANDIDATES) {
    try {
      const res = await expert.pages.getPageFind(parseInt(coverID), params as any);
      const pages = many<Record<string, any>>(res.page as any);
      const count = Number(res["@count"] ?? 0);
      const total = Number(res["@totalcount"] ?? 0);

      const byID = new Map<string, string>();
      for (const page of pages) {
        const restriction = pageRestriction(page);
        if (page["@id"] && restriction) byID.set(String(page["@id"]), restriction);
      }

      const covered = allIDs.filter((id) => byID.has(id)).length;
      console.log(
        `find ${label}: @count=${count} @totalcount=${total} pages=${pages.length} ` +
          `withRestriction=${byID.size} coversTree=${covered}/${allIDs.length}` +
          (total > count ? "  TRUNCATED" : ""),
      );

      if (!best || byID.size > best.byID.size) best = { label, byID };
    } catch (err: any) {
      console.log(`find ${label}: FAILED ${err?.message ?? err}`);
    }
  }

  if (!best) {
    console.log("\nNo constraint returned anything. Restrictions must come from elsewhere.");
    return;
  }

  console.log(`\nbest constraint: ${best.label}`);

  const tally = new Map<string, number>();
  for (const r of best.byID.values()) tally.set(r, (tally.get(r) ?? 0) + 1);
  console.log("restriction tally:");
  for (const [name, n] of [...tally].sort()) {
    console.log(`  ${name}: ${n}${isPubliclyListable(name) ? "" : "  (would be hidden)"}`);
  }

  const missing = allIDs.slice(1).filter((id) => !best!.byID.has(id));
  console.log(
    `\n${missing.length} of ${allIDs.length - 1} non-cover pages need a per-page read ` +
      `(MAX_SECURITY_BACKFILL is 60).`,
  );

  console.log("\npruned from the filtered TOC (before any per-page backfill):");
  const walk = (node: any, depth: number): void => {
    const id = String(node["@id"]);
    const restriction = best!.byID.get(id);
    if (depth > 0 && !isPubliclyListable(restriction)) {
      console.log(
        `  ${"  ".repeat(depth)}${node.title} (${id}) restriction=${restriction ?? "UNKNOWN"}`,
      );
      return;
    }
    for (const child of many<any>(node.subpages?.page)) walk(child, depth + 1);
  };
  walk(root, 0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
