/**
 * probeCoverpageFind.ts
 *
 * Read-only diagnostic for the `/pages/{id}/find?tags=coverpage:yes` behavior
 * that caused the Commons sync to ingest non-book pages.
 *
 * `LibrarySyncService` asks CXOne to filter the subtree search by tag and, until
 * the fix, trusted the result. It shouldn't have: pages without the tag come
 * back anyway. This script characterizes that at the API boundary so the
 * client-side gate in `keepEligiblePages` can be judged against evidence rather
 * than assumption. It answers three questions:
 *
 *   1. Is the `tags=` filter honored at all? Compare the tagged and untagged
 *      result counts. Identical counts mean the parameter is being ignored and
 *      `find` is returning the whole subtree.
 *   2. Does `include=tags` actually populate tags on the response? If it does
 *      not, every page looks untagged and a client-side gate would reject the
 *      entire catalog — check this BEFORE trusting a sync run.
 *   3. Is `article:topic-category` the right discriminator for a real book?
 *      The article-type distribution over the genuinely coverpage-tagged pages
 *      shows whether requiring it would exclude published books.
 *
 * Sends only GETs. Writes nothing, to CXOne or to Mongo.
 *
 * Usage (from server/):
 *   npx tsx scripts/probeCoverpageFind.ts [library] [root]
 *   npx tsx scripts/probeCoverpageFind.ts workforce Bookshelves
 *   npx tsx scripts/probeCoverpageFind.ts chem Courses
 *
 * Credentials resolve exactly as they do in the server: ExpertWithSSM pulls the
 * per-library key/secret pair from AWS SSM Parameter Store, so this needs the
 * usual AWS chain (env / shared config) plus AWS_REGION,
 * AWS_SSM_LIB_TOKEN_PAIR_PATH and LIBRARIES_API_USERNAME. `.env` is loaded.
 */
import logger from "../logger.js";
import "dotenv/config";
import Expert from "../util/ExpertWithSSM.js";
import type { PageBase, PageTag, Tags } from "@libretexts/cxone-expert-node";

// ---------------------------------------------------------------------------
// Knobs
// ---------------------------------------------------------------------------

const DEFAULT_LIBRARY = "workforce";
const DEFAULT_ROOT = "Bookshelves";

/** The tag the sync filters on, and the article type it now also requires. */
const COVERPAGE_TAG = "coverpage:yes";
const TOPIC_CATEGORY_TAG = "article:topic-category";

/** How many example paths to print per category. */
const SAMPLE_SIZE = 10;

// ---------------------------------------------------------------------------

type FoundPage = Partial<PageBase> & Partial<Tags>;

/** CXOne returns repeated elements as object | array | "" depending on cardinality. */
function toArray<T>(value: T | T[] | "" | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Tag titles for a page. Mirrors `LibrarySyncService.tagTitles` exactly — the
 * SDK types tags as flattened onto the page but the wire format nests them, and
 * a probe that read only one shape would report a false negative for question 2.
 */
function tagTitles(page: FoundPage): string[] {
  const nested = (page as { tags?: Partial<Tags> | "" }).tags;
  const raw: (Partial<PageTag> | "")[] = [
    ...toArray(page.tag),
    ...toArray(nested ? nested.tag : undefined),
  ];
  return raw
    .map((t) => (t ? t.title : undefined))
    .filter((t): t is string => typeof t === "string");
}

function pagePath(page: FoundPage): string {
  return page.path ? page.path["#text"] ?? "" : "";
}

/** Descending count, for readable distribution output. */
function tally(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function printSamples(label: string, pages: FoundPage[]) {
  if (pages.length === 0) return;
  logger.info(`\n  ${label} (${pages.length}, showing up to ${SAMPLE_SIZE}):`);
  for (const page of pages.slice(0, SAMPLE_SIZE)) {
    const tags = tagTitles(page);
    logger.info(`    ${page["@id"] ?? "?"}  ${pagePath(page) || "(no path)"}`);
    logger.info(`        tags: ${tags.join(", ") || "(none returned)"}`);
  }
}

async function main() {
  const [, , libraryArg, rootArg] = process.argv;
  const library = libraryArg || DEFAULT_LIBRARY;
  const root = rootArg || DEFAULT_ROOT;

  logger.info(`Probing ${library} / ${root}\n`);

  const expert = await Expert.getInstance().forLibrary(library);

  // --- Q1: is the tags= filter honored? -----------------------------------
  const tagged = await expert.pages.getPageFind(root, {
    tags: COVERPAGE_TAG,
    include: "tags",
  });
  const untagged = await expert.pages.getPageFind(root, { include: "tags" });

  const taggedCount = Number(tagged["@count"] ?? 0);
  const taggedTotal = Number(tagged["@totalcount"] ?? 0);
  const untaggedCount = Number(untagged["@count"] ?? 0);
  const untaggedTotal = Number(untagged["@totalcount"] ?? 0);

  logger.info("Q1. Is the `tags=` filter honored?");
  logger.info(`  with tags=${COVERPAGE_TAG}: count=${taggedCount} totalcount=${taggedTotal}`);
  logger.info(`  without tags:              count=${untaggedCount} totalcount=${untaggedTotal}`);
  logger.info(taggedTotal === untaggedTotal
          ? "  => IDENTICAL totals. The filter is being ignored; `find` is returning\n" +
            "     the whole subtree and every page in it was becoming a Book."
          : "  => Totals differ, so the filter has some effect. Any untagged pages\n" +
            "     below are leaking through it rather than bypassing it entirely.");

  // --- Q2: does include=tags populate tags? -------------------------------
  const pages = toArray(tagged.page);
  const withAnyTags = pages.filter((p) => tagTitles(p).length > 0);

  logger.info("\nQ2. Does `include=tags` populate tags on the response?");
  logger.info(`  ${withAnyTags.length} of ${pages.length} returned pages carry at least one tag.`);
  if (pages.length > 0 && withAnyTags.length === 0) {
    logger.info("  => NO TAGS AT ALL. Do not enable the client-side tag gate: it would\n" +
              "     reject the entire catalog. Tags must be sourced another way.");
  } else {
    logger.info("  => Tags are present and can be gated on.");
  }

  // --- Q3: is article:topic-category the right discriminator? -------------
  const hasCoverpage = pages.filter((p) => tagTitles(p).includes(COVERPAGE_TAG));
  const hasBoth = hasCoverpage.filter((p) =>
    tagTitles(p).includes(TOPIC_CATEGORY_TAG),
  );
  const coverpageOnly = hasCoverpage.filter(
    (p) => !tagTitles(p).includes(TOPIC_CATEGORY_TAG),
  );
  const noCoverpage = pages.filter(
    (p) => !tagTitles(p).includes(COVERPAGE_TAG),
  );

  logger.info("\nQ3. What did the tagged query actually return?");
  logger.info(`  total returned:                    ${pages.length}`);
  logger.info(`  carrying ${COVERPAGE_TAG}:              ${hasCoverpage.length}`);
  logger.info(`  carrying BOTH required tags:       ${hasBoth.length}`);
  logger.info(`  coverpage tag but NOT topic-category: ${coverpageOnly.length}`);
  logger.info(`  missing the coverpage tag entirely:   ${noCoverpage.length}`);

  logger.info("\n  article:* distribution over ALL returned pages:");
  const articleTags = pages.flatMap((p) =>
    tagTitles(p).filter((t) => t.startsWith("article:")),
  );
  for (const [tag, count] of tally(articleTags)) {
    logger.info(`    ${count.toString().padStart(6)}  ${tag}`);
  }
  if (articleTags.length === 0) logger.info("    (none)");

  logger.info(`\n  article:* distribution over pages carrying ${COVERPAGE_TAG} only:`);
  const coverpageArticleTags = hasCoverpage.flatMap((p) =>
    tagTitles(p).filter((t) => t.startsWith("article:")),
  );
  for (const [tag, count] of tally(coverpageArticleTags)) {
    logger.info(`    ${count.toString().padStart(6)}  ${tag}`);
  }
  if (coverpageArticleTags.length === 0) logger.info("    (none)");
  logger.info("\n  If anything other than article:topic-category appears above in\n" +
          "  meaningful numbers, requiring it would drop real books.");

  printSamples("Rejected: missing the coverpage tag", noCoverpage);
  printSamples(
    "Rejected: coverpage tag but no topic-category (INSPECT THESE)",
    coverpageOnly,
  );
  printSamples("Accepted: carrying both required tags", hasBoth);
}

main().catch((err) => {
  logger.error({ err }, "probeCoverpageFind failed");
  process.exit(1);
});
