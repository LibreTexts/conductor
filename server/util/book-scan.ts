/**
 * One page-by-page scan of a book that feeds both the License Restacker and the Attribution
 * Manager. Both tools need the same library data for every page (its tags, whether it is a
 * transclusion stub, the content it reuses and those pages' tags), so the scan fetches each page
 * once and writes both tools' stored data from it. Refreshing either tool refreshes both.
 */
import * as cheerio from "cheerio";
import { childLogger } from "../logger.js";
import BookService from "../api/services/book-service.js";
import Restacker from "../models/restacker.js";
import Authorship, { AUTHORSHIP_DOC_VERSION } from "../models/authorship.js";
import type { ProjectInterface } from "../models/project.js";
import { sleep } from "./helpers.js";
import { libraryKeys } from "./libraries.js";
import { containsReuseMarkup, detectTranscludeStub } from "./transclusion.js";
import { distinctCreditRefs, readAllCreditTags, type CreditTagRef } from "./author-tags.js";
import RestackerService from "./Restackerutil.js";
import AuthorshipService from "./Authorshiputil.js";

const scanLog = childLogger("book-scan");

export type ScanMode = "content" | "page";

/** Everything one page contributes to the two tools, fetched once. */
export type PageScan = {
  /** The page's own tags. */
  tags: string[];
  /** Present when the page's body was scanned (always in `content` mode). */
  content?: {
    /** The page is wholly a pointer to another page (a transclusion stub). */
    transcluded: boolean;
    /** The page carries reuse markup of any kind, stub or embedded. */
    reusesContent: boolean;
    /** Tags of the page a stub points at, when it could be read. */
    sourceTags?: string[];
    /** Pages reused inside this one through `lt-<library>-<id>` content, with their tags. */
    refs: { library: string; pageID: string; tags: string[] }[];
    /** Share of text blocks that are quoted content; 1 for reusing pages, -1 with no body. */
    quotationRate: number;
  };
};

type License = { label: string; raw: string; version: string };

// ── Pure derivations ──────────────────────────────────────────────────────────

/** A page's `license:`/`licenseversion:` tags, stored as the Restacker always has. */
export function licenseFromTags(tags: string[]): License | undefined {
  const license = tags.find((t) => t.startsWith("license:"));
  if (!license) return undefined;
  const version = tags.find((t) => t.startsWith("licenseversion:")) ?? "";
  return { label: license, raw: version, version };
}

/** The Restacker's stored fields for one page. Content fields only when the body was scanned. */
export function restackerFieldsFromScan(scan: PageScan): {
  license?: License;
  content?: { contentLicense?: License[]; sourceLicense?: License; quotation: number };
} {
  const license = licenseFromTags(scan.tags);
  if (!scan.content) return { license };

  const unique = new Map<string, License>();
  for (const ref of scan.content.refs) {
    const refLicense = licenseFromTags(ref.tags);
    if (refLicense) unique.set(`${refLicense.label}::${refLicense.version}`, refLicense);
  }
  return {
    license,
    content: {
      contentLicense: unique.size > 0 ? Array.from(unique.values()) : undefined,
      sourceLicense:
        scan.content.transcluded && scan.content.sourceTags
          ? licenseFromTags(scan.content.sourceTags)
          : undefined,
      quotation: scan.content.quotationRate,
    },
  };
}

/** The Attribution Manager's stored fields for one page. */
export function authorshipFieldsFromScan(scan: PageScan): {
  pageCredits: CreditTagRef[];
  content?: { sourceCredits: CreditTagRef[]; contentCredits: CreditTagRef[] };
} {
  const pageCredits = readAllCreditTags(scan.tags);
  if (!scan.content) return { pageCredits };
  return {
    pageCredits,
    content: {
      sourceCredits:
        scan.content.transcluded && scan.content.sourceTags
          ? readAllCreditTags(scan.content.sourceTags)
          : [],
      contentCredits: distinctCreditRefs(
        scan.content.refs.flatMap((ref) => readAllCreditTags(ref.tags)),
      ),
    },
  };
}

// ── Fetching ──────────────────────────────────────────────────────────────────

/**
 * Fetches pages from the library for one scan run, caching every page's tags so a page reused
 * many times (or both tools needing it) is read once. The fetch logic is the License
 * Restacker's, unchanged, so its results stay the same.
 */
export class BookPageScanner {
  private tags = new Map<string, string[]>();
  private ltRegex = new RegExp(`\\blt-(${libraryKeys})-\\d+\\b`, "g");

  async getTags(library: string, pageID: string): Promise<string[]> {
    const key = `${library}:${pageID}`;
    const cached = this.tags.get(key);
    if (cached) return cached;
    const tags = (await new BookService({ bookID: `${library}-${pageID}` }).getPageTags(pageID)).map(
      (t) => t["@value"],
    );
    this.tags.set(key, tags);
    return tags;
  }

  async scanPage(library: string, coverID: string, pageID: string, content: boolean): Promise<PageScan> {
    const tags = await withRetryOnTransient(() => this.getTags(library, pageID));
    if (!content) return { tags };
    return {
      tags,
      content: await withRetryOnTransient(() => this.scanContent(library, coverID, pageID, tags)),
    };
  }

  private async scanContent(
    library: string,
    coverID: string,
    pageID: string,
    pageTags: string[],
  ): Promise<NonNullable<PageScan["content"]>> {
    const html = await new BookService({ bookID: `${library}-${coverID}` }).getPageContent(
      pageID,
      "json",
    );
    if (!html) {
      return { transcluded: false, reusesContent: false, refs: [], quotationRate: -1 };
    }
    const page = String(html);

    // Reused content: every distinct lt-<library>-<id> class in the page.
    const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);
    const classnames = new Set([...cheerio.load(page).html().matchAll(ltRegex)].map((m) => m[0]));
    const refs: { library: string; pageID: string; tags: string[] }[] = [];
    for (const classname of classnames) {
      const [, refLibrary, refPageID] = classname.split("-");
      refs.push({ library: refLibrary, pageID: refPageID, tags: await this.getTags(refLibrary, refPageID) });
    }

    const transclusion = await this.detectTransclusion(library, pageID, pageTags);
    // A page built entirely from someone else's content is 100% quotation. The quotation rate
    // only counts lt- classed text, so it reads reuse widgets as 0, hence the pin.
    const quotationRate = transclusion.reusesContent ? 1 : this.quotationRate(page);
    return { ...transclusion, refs, quotationRate };
  }

  /**
   * Only a page whose whole body points at another page is transcluded; one that merely embeds
   * reuse blocks owns its content. Marks a transcluded page `transcluded:yes` if it isn't yet.
   * Any failure reads as not transcluded, as the Restacker always has.
   */
  private async detectTransclusion(
    library: string,
    pageID: string,
    pageTags: string[],
  ): Promise<{ transcluded: boolean; reusesContent: boolean; sourceTags?: string[] }> {
    try {
      const bookService = new BookService({ bookID: `${library}-${pageID}` });
      const raw = await bookService.getPageRawContent(pageID);
      if (!raw) return { transcluded: false, reusesContent: false };
      const stub = detectTranscludeStub(raw);
      if (!stub) return { transcluded: false, reusesContent: containsReuseMarkup(raw) };

      if (!pageTags.some((t) => t.startsWith("transcluded:"))) {
        await bookService.updatePageDetails(pageID, undefined, [...pageTags, "transcluded:yes"]);
      }
      const sourceTags =
        stub.kind === "cross-library"
          ? await this.getTags(stub.subdomain, String(stub.pageID))
          : await this.getTags(library, stub.path);
      return { transcluded: true, reusesContent: true, sourceTags };
    } catch {
      return { transcluded: false, reusesContent: false };
    }
  }

  private quotationRate(content: string): number {
    try {
      const $ = cheerio.load(content);
      const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);
      const textTags = $("p, h1, h2, h3, h4, h5, h6");
      if (textTags.length === 0) return 0;
      let quoted = 0;
      textTags.each((_, el) => {
        ltRegex.lastIndex = 0;
        if (ltRegex.test($(el).attr("class") ?? "")) quoted += 1;
      });
      return quoted / textTags.length;
    } catch {
      return -1;
    }
  }
}

/**
 * Retries transient library failures with growing waits (60s, then 120s), as the Restacker
 * always has: the library can stay unresponsive for a while.
 */
async function withRetryOnTransient<T>(fn: () => Promise<T>): Promise<T> {
  const DELAYS_MS = [60_000, 120_000];
  const isTransient = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      /transient error|timeout|timed out|etimedout|econnreset|socket hang up/.test(msg) ||
      /\b400\b/.test(error.message) ||
      /\b404\b/.test(error.message)
    );
  };
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= DELAYS_MS.length || !isTransient(error)) throw error;
      scanLog.warn(
        { err: error instanceof Error ? error.message : error },
        `Transient error; retrying in ${DELAYS_MS[attempt] / 1000}s`,
      );
      await sleep(DELAYS_MS[attempt]);
    }
  }
}

// ── Documents and locks ───────────────────────────────────────────────────────

export type ScanPageSeed = { id: string; title: string; url: string };

/** The book cover followed by every page, in TOC order. */
export async function buildScanPageList(project: ProjectInterface): Promise<ScanPageSeed[]> {
  const toc = await new BookService({
    bookID: `${project.libreLibrary}-${project.libreCoverID}`,
  }).getBookTOCNew();
  const flatten = (pages: typeof toc.children): ScanPageSeed[] =>
    pages?.flatMap((page) => [
      { id: page.id, title: page.title, url: page.url },
      ...flatten(page.children ?? []),
    ]) ?? [];
  return [{ id: toc.id, title: toc.title, url: toc.url }, ...flatten(toc.children ?? [])];
}

/** Creates whichever of the two tools' documents doesn't exist yet, every page pending. */
export async function ensureScanDocs(project: ProjectInterface, actorUUID: string) {
  const projectID = project.projectID;
  const [hasRestacker, hasAuthorship] = await Promise.all([
    Restacker.exists({ projectID: { $eq: projectID } }),
    Authorship.exists({ projectID: { $eq: projectID } }),
  ]);
  if (hasRestacker && hasAuthorship) return;

  const pages = (await buildScanPageList(project)).map((p) => ({ ...p, status: "pending" as const }));
  const owner = { projectID, createdBy: actorUUID, updatedBy: actorUUID };
  await Promise.all([
    // Created concurrently with another request is fine: the duplicate insert just fails.
    hasRestacker ? null : Restacker.create({ ...owner, restackerCurrentBook: pages }).catch(() => null),
    hasAuthorship
      ? null
      : Authorship.create({ ...owner, version: AUTHORSHIP_DOC_VERSION, pages }).catch(() => null),
  ]);
}

export type ScanLocks = { restacker: string; authorship: string };

/** Takes both tools' locks, or neither: a scan writes both documents. */
export async function acquireScanLocks(projectID: string): Promise<ScanLocks | null> {
  const restacker = await RestackerService.acquireLock(projectID);
  if (!restacker) return null;
  const authorship = await AuthorshipService.acquireLock(projectID);
  if (!authorship) {
    await RestackerService.releaseLock(projectID, restacker);
    return null;
  }
  return { restacker, authorship };
}

/**
 * Re-queues every page of both tools for the next scan, under the locks just taken. `content`
 * drops the stored data so everything is re-read; `page` keeps each page's content data and only
 * re-queues its tags. Pages new to the TOC are added (and get a full scan); removed ones dropped.
 */
export async function resetScanPages(
  project: ProjectInterface,
  locks: ScanLocks,
  mode: ScanMode,
  actorUUID: string,
) {
  const projectID = project.projectID;
  const seeds = await buildScanPageList(project);
  const [restackerDoc, authorshipDoc] = await Promise.all([
    Restacker.findOne({ projectID: { $eq: projectID } }),
    Authorship.findOne({ projectID: { $eq: projectID } }),
  ]);

  const requeue = <T extends { id: string }>(existing: T[]) => {
    const byID = new Map(existing.map((p) => [p.id, p]));
    return seeds.map((seed) => ({
      ...(mode === "page" ? byID.get(seed.id) : {}),
      ...seed,
      status: "pending" as const,
    }));
  };

  await Promise.all([
    Restacker.updateOne(
      { projectID: { $eq: projectID }, processingLockID: { $eq: locks.restacker } },
      {
        $set: {
          restackerCurrentBook: requeue(restackerDoc?.toObject().restackerCurrentBook ?? []),
          updatedBy: actorUUID,
          ...(mode === "content" ? { message: [] } : {}),
        },
      },
    ),
    Authorship.updateOne(
      { projectID: { $eq: projectID }, processingLockID: { $eq: locks.authorship } },
      {
        $set: {
          pages: requeue(authorshipDoc?.toObject().pages ?? []),
          version: AUTHORSHIP_DOC_VERSION,
          updatedBy: actorUUID,
        },
      },
    ),
  ]);
}

// ── The combined run ──────────────────────────────────────────────────────────

const PERSIST_BATCH_SIZE = 10;
/** Tag-only refreshes make one request per page, so a few can run at once. */
const PAGE_MODE_CONCURRENCY = 5;

/**
 * Scans every page that is pending in either tool and writes both tools' data from the one
 * fetch. `content` reads each page's body too (slow); `page` reads tags only and keeps the stored
 * content data, except for pages never content-scanned, which still get the full scan.
 *
 * Takes both locks itself unless the caller hands them over (a reload resets the page lists
 * under the locks first). Returns false when another run or a bulk update holds either lock.
 */
export async function runBookScan(
  project: ProjectInterface,
  mode: ScanMode,
  heldLocks?: ScanLocks,
): Promise<boolean> {
  const projectID = project.projectID;
  const library = project.libreLibrary as string;
  const coverID = project.libreCoverID as string;

  const locks = heldLocks ?? (await acquireScanLocks(projectID));
  if (!locks) {
    scanLog.info({ projectID }, "Book scan skipped; a scan or bulk update is already running");
    return false;
  }

  const heartbeat = setInterval(() => {
    const now = new Date();
    Promise.all([
      Restacker.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: locks.restacker } },
        { $set: { processingHeartbeatAt: now } },
      ),
      Authorship.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: locks.authorship } },
        { $set: { processingHeartbeatAt: now } },
      ),
    ]).catch((err) => scanLog.warn({ err, projectID }, "Failed to refresh scan lock heartbeats"));
  }, 60_000);

  try {
    const [restackerDoc, authorshipDoc] = await Promise.all([
      Restacker.findOne({ projectID: { $eq: projectID } }),
      Authorship.findOne({ projectID: { $eq: projectID } }),
    ]);
    if (!restackerDoc || !authorshipDoc) throw new Error("Scan documents not found");

    const restackerPages = restackerDoc.restackerCurrentBook;
    const authorshipPages = authorshipDoc.pages;
    const restackerByID = new Map(restackerPages.map((p) => [p.id, p]));
    const authorshipByID = new Map(authorshipPages.map((p) => [p.id, p]));
    // Every page either tool knows about, in book order.
    const pageIDs = [
      ...new Set([...restackerPages.map((p) => p.id), ...authorshipPages.map((p) => p.id)]),
    ];

    // Each flush is guarded by its own lock, so a superseded run can't overwrite a newer one.
    const flush = () =>
      Promise.all([
        Restacker.updateOne(
          { projectID: { $eq: projectID }, processingLockID: { $eq: locks.restacker } },
          { $set: { restackerCurrentBook: restackerPages } },
        ),
        Authorship.updateOne(
          { projectID: { $eq: projectID }, processingLockID: { $eq: locks.authorship } },
          { $set: { pages: authorshipPages } },
        ),
      ]);

    const scanner = new BookPageScanner();
    const processPage = async (pageID: string) => {
      const r = restackerByID.get(pageID);
      const a = authorshipByID.get(pageID);
      const rPending = r?.status === "pending";
      const aPending = a?.status === "pending";
      if (!rPending && !aPending) return;

      // A completed content scan always sets the Restacker's `quotation` and the Attribution
      // Manager's `contentScanned`, so their absence means the page was never content-scanned.
      const needsContent =
        mode === "content" ||
        (rPending && r?.quotation === undefined) ||
        (aPending && !a?.contentScanned);
      try {
        const scan = await scanner.scanPage(library, coverID, pageID, needsContent);
        if (r && rPending) {
          const fields = restackerFieldsFromScan(scan);
          r.license = fields.license;
          if (fields.content) {
            r.contentLicense = fields.content.contentLicense;
            r.sourceLicense = fields.content.sourceLicense;
            r.quotation = fields.content.quotation;
          }
          r.status = "completed";
        }
        if (a && aPending) {
          const fields = authorshipFieldsFromScan(scan);
          a.pageCredits = fields.pageCredits.length ? fields.pageCredits : undefined;
          if (fields.content) {
            a.sourceCredits = fields.content.sourceCredits.length ? fields.content.sourceCredits : undefined;
            a.contentCredits = fields.content.contentCredits.length ? fields.content.contentCredits : undefined;
            a.contentScanned = true;
          }
          a.status = "completed";
        }
      } catch (err) {
        scanLog.warn({ err, projectID, pageID }, "Book scan failed for page");
        if (r && rPending) r.status = "failed";
        if (a && aPending) a.status = "failed";
      }
    };

    const concurrency = mode === "page" ? PAGE_MODE_CONCURRENCY : 1;
    let sinceFlush = 0;
    for (let i = 0; i < pageIDs.length; i += concurrency) {
      const chunk = pageIDs.slice(i, i + concurrency);
      await Promise.all(chunk.map(processPage));
      sinceFlush += chunk.length;
      if (sinceFlush >= PERSIST_BATCH_SIZE) {
        await flush();
        sinceFlush = 0;
      }
    }
    await flush();
    return true;
  } finally {
    clearInterval(heartbeat);
    await Promise.all([
      RestackerService.releaseLock(projectID, locks.restacker),
      AuthorshipService.releaseLock(projectID, locks.authorship),
    ]);
  }
}
