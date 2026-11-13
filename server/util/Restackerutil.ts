import logger, { childLogger } from "../logger.js";
import BookService from "../api/services/book-service";
import Restacker, { RestackerInterface, RestackerStatus } from "../models/restacker";
import { PageTag } from "../types/Book";
import { randomUUID } from "node:crypto";
import { sleep } from "./helpers";
import { detectTranscludeStub } from "./transclusion.js";
import { parseLtClasses, quotationRate as ltQuotationRate } from "./lt-classes.js";
const restackerLog = childLogger("restacker");

export type RestackerRefreshMode = "content" | "page";

class RestackerService {
  private pageTags: Map<string, PageTag[]>;

  constructor() {
    this.pageTags = new Map<string, PageTag[]>();
  }

  // Persist progress every N pages so a pollable status endpoint reflects near-real-time
  // progress instead of a single all-or-nothing write at the end of the run.
  private static readonly PERSIST_BATCH_SIZE = 10;

  // Page-level refreshes make one tag request per page, so a few can safely run at once.
  private static readonly PAGE_LEVEL_CONCURRENCY = 5;

  /**
   * A `processing` lock whose heartbeat is older than this is treated as abandoned
   * (the holder crashed or was redeployed mid-run). The heartbeat runs on a timer,
   * not per page, so a page stuck in `withRetryOnTransient` backoff can't age it out.
   */
  static readonly LOCK_STALE_MS = 10 * 60_000;
  private static readonly LOCK_HEARTBEAT_MS = 60_000;

  /** True while a live run holds the project's `processing` lock. */
  static isLockActive(
    restacker: Pick<RestackerInterface, "processing" | "processingHeartbeatAt"> | null | undefined,
  ): boolean {
    if (!restacker?.processing || !restacker.processingHeartbeatAt) return false;
    const heartbeatAt = new Date(restacker.processingHeartbeatAt).getTime();
    return Date.now() - heartbeatAt < RestackerService.LOCK_STALE_MS;
  }

  /**
   * Atomically takes the project's `processing` lock if it is free or stale.
   * Returns the lock ID to pass to `withLock`/`releaseLock`, or null if a live run holds it.
   */
  static async acquireLock(projectID: string): Promise<string | null> {
    const now = new Date();
    const lockID = randomUUID();
    const result = await Restacker.updateOne(
      {
        projectID: { $eq: projectID },
        $or: [
          { processing: { $ne: true } },
          { processingHeartbeatAt: { $exists: false } },
          {
            processingHeartbeatAt: {
              $lt: new Date(now.getTime() - RestackerService.LOCK_STALE_MS),
            },
          },
        ],
      },
      { $set: { processing: true, processingLockID: lockID, processingHeartbeatAt: now } },
    );
    return result.modifiedCount === 1 ? lockID : null;
  }

  /** Releases the lock, but only if `lockID` still owns it. */
  static async releaseLock(projectID: string, lockID: string) {
    await Restacker.updateOne(
      { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
      {
        $set: { processing: false },
        $unset: { processingLockID: "", processingHeartbeatAt: "" },
      },
    );
  }

  /** Runs `fn` while keeping the lock's heartbeat fresh, then releases the lock. */
  static async withLock<T>(
    projectID: string,
    lockID: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const heartbeat = setInterval(() => {
      Restacker.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        { $set: { processingHeartbeatAt: new Date() } },
      ).catch((err) => {
        restackerLog.warn({ err, projectID }, "Failed to refresh restacker lock heartbeat");
      });
    }, RestackerService.LOCK_HEARTBEAT_MS);
    try {
      return await fn();
    } finally {
      clearInterval(heartbeat);
      await RestackerService.releaseLock(projectID, lockID);
    }
  }

  /**
   * Retries on transient MindTouch/destination failures with incremental delay.
   * The remote may stay unresponsive for a while; waits between attempts and
   * gives up after 3 tries (~3 minutes of backoff total).
   */
  private async withRetryOnTransient<T>(fn: () => Promise<T>): Promise<T> {
    const ATTEMPTS = 3;
    // Incremental waits between attempts: 60s + 120s ≈ 3 minutes total backoff
    const DELAYS_MS = [60_000, 120_000] as const;

    const isTransientError = (error: unknown): boolean => {
      if (!(error instanceof Error)) return false;
      const msg = error.message.toLowerCase();
      if (msg.includes("transient error")) return true;
      if (
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("etimedout") ||
        msg.includes("econnreset") ||
        msg.includes("socket hang up")
      )
        return true;
      // HTTP status codes embedded in error messages (e.g. "Error 400", "400 Bad Request")
      if (/\b400\b/.test(error.message) || /\b404\b/.test(error.message))
        return true;
      return false;
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt >= ATTEMPTS || !isTransientError(error)) {
          throw error;
        }
        const delayMs = DELAYS_MS[attempt - 1] ?? DELAYS_MS[DELAYS_MS.length - 1];
        restackerLog.warn({ err: error instanceof Error ? error.message : error }, `Transient error on attempt ${attempt}/${ATTEMPTS}; retrying in ${Math.round(delayMs / 1000)}s…`);
        await sleep(delayMs);
      }
    }
    throw lastError;
  }

  /**
   * Refreshes license data for every pending page.
   * - `content`: reads page license tags and scans each page's HTML for embedded
   *   content licenses, source (transclusion) license, and quotation rate. Slow.
   * - `page`: reads only page license tags and keeps the stored content data, so it
   *   can run several pages in parallel. Pages never content-scanned (e.g. added
   *   since the last refresh) still get the full scan.
   */
  async runRestacker(
    projectID: string,
    library: string,
    coverID: string,
    mode: RestackerRefreshMode = "content",
    heldLockID?: string,
  ) {
    // Callers that must reset the page list under the lock (reload) take it first and
    // hand it over; otherwise take it here. Either way, it is released in `withLock`.
    const lockID = heldLockID ?? (await RestackerService.acquireLock(projectID));
    if (!lockID) {
      restackerLog.info({ projectID }, "Restacker run skipped; another run holds the lock");
      return;
    }
    await RestackerService.withLock(projectID, lockID, () =>
      this.processPendingPages(projectID, library, coverID, mode, lockID),
    );
  }

  private async processPendingPages(
    projectID: string,
    library: string,
    coverID: string,
    mode: RestackerRefreshMode,
    lockID: string,
  ) {
    const restacker = await Restacker.findOne({
      projectID: { $eq: projectID },
    });
    if (!restacker) {
      throw new Error("Restacker not found");
    }

    const pages = restacker.restackerCurrentBook;

    // Filtered on the lock ID so a run whose lock went stale and was taken over
    // can't overwrite the newer run's progress.
    const flush = () =>
      Restacker.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        { $set: { restackerCurrentBook: pages } },
      );

    const processPage = async (page: (typeof pages)[number]) => {
      if (page.status !== "pending") return;
      restackerLog.info(`[runRestacker][${projectID}] Processing page ${page.id} (${mode} level)`);
      try {
        page.license = await this.withRetryOnTransient(async () => await this.getPagelicense(page.id, library, coverID));
        // Every completed content scan sets `quotation` (-1 when the page body is missing),
        // so its absence means this page has never been scanned.
        const hasContentData = page.quotation !== undefined;
        if (mode === "content" || !hasContentData) {
          const contentLicense = await this.withRetryOnTransient(async () => await this.getContentLicense(
            page.id,
            library,
            coverID,
          ));
          page.contentLicense = contentLicense.contentLicenses;
          page.quotation = contentLicense.quotationRate;
          page.sourceLicense = contentLicense.sourceLicense;
        }
        page.status = "completed";
      } catch (error) {
        page.status = "failed";
      }
    };

    const concurrency =
      mode === "page" ? RestackerService.PAGE_LEVEL_CONCURRENCY : 1;

    let sincePersist = 0;
    for (let i = 0; i < pages.length; i += concurrency) {
      const chunk = pages.slice(i, i + concurrency);
      await Promise.all(chunk.map(processPage));

      sincePersist += chunk.length;
      if (sincePersist >= RestackerService.PERSIST_BATCH_SIZE) {
        await flush();
        sincePersist = 0;
      }
    }
    // Final flush for the remaining pages in the last (partial) batch.
    await flush();
  }

  async getRestackerStatus(projectIDOrRestackerObj: string | RestackerInterface): Promise<{
    statusCode: RestackerStatus | "notfound";
    allPending?: boolean;
    processing?: boolean;
    total?: number;
    completed?: number;
    failed?: number;
    pending?: number;
  }> {
    let restacker: RestackerInterface | null;

    if (typeof projectIDOrRestackerObj === "string") {
      restacker = await Restacker.findOne({ projectID: { $eq: projectIDOrRestackerObj } });
    } else {
      restacker = projectIDOrRestackerObj;
    }

    if (!restacker) {
      return { statusCode: "notfound" };
    }

    const pages = restacker.restackerCurrentBook;
    const total = pages.length;
    const pending = pages.filter((page) => page.status === "pending").length;
    const failed = pages.filter((page) => page.status === "failed").length;
    const completed = total - pending - failed;
    // A stale lock reads as not processing, so callers can resume or restart the run.
    const processing = RestackerService.isLockActive(restacker);
    const counts = { processing, total, completed, failed, pending };

    if (pending > 0) {
      return { statusCode: "pending", allPending: pending === total, ...counts };
    }

    if (failed > 0) return { statusCode: "failed", ...counts };

    return { statusCode: "completed", ...counts };
  }



  private pageTagsKey(library: string, pageID: string): string {
    return `${library}:${pageID}`;
  }

  private async getCachedPageTags(
    library: string,
    pageID: string,
    bookID: string,
  ): Promise<PageTag[]> {
    const key = this.pageTagsKey(library, pageID);
    const cached = this.pageTags.get(key);
    if (cached) {
      return cached;
    }

    const bookService = new BookService({ bookID });
    const tags = await bookService.getPageTags(pageID);
    this.pageTags.set(key, tags);
    return tags;
  }

  private async getPagelicense(
    pageID: string,
    library: string,
    coverID: string,
    isContentLicense:boolean = false,
  ): Promise<{ label: string; raw: string; version: string } | undefined> {
    const page = await this.getCachedPageTags(
      library,
      pageID,
      `${library}-${coverID}`,
    );
    if (!page) {
      throw new Error("Page not found");
    }
    const licenseTag = page.find((tag) => tag["@value"].startsWith("license:"));
    const licenseVersionTag = page.find((tag) =>
      tag["@value"].startsWith("licenseversion:"),
    );
    if (!isContentLicense) {
      // Cache tags for later use (e.g. transclusion tagging) using the same key shape as getCachedPageTags().
      this.pageTags.set(this.pageTagsKey(library, pageID), page);
    }
    if (!licenseTag) {
      return undefined;
    }
    return {
      label: licenseTag["@value"],
      raw: licenseVersionTag?.["@value"] ?? "",
      version: licenseVersionTag?.["@value"] ?? "",
    };
  }

  private async isTranscluded(
    pageID: string,
    library: string,
  ): Promise<{
    isTranscluded: boolean;
    sourceLicense: { label: string; raw: string; version: string } | undefined;
  }> {
    const notTranscluded = () => ({
      isTranscluded: false,
      sourceLicense: undefined,
    });

    try {
      const bookService = new BookService({ bookID: `${library}-${pageID}` });
      const rawContents = await bookService.getPageRawContent(pageID);
      if (!rawContents) {
        return notTranscluded();
      }
      // Only a page whose whole body is a pointer at another page is
      // transcluded. A page that merely embeds content-reuse blocks owns its
      // content: tagging it `transcluded:yes` or giving it the embedded
      // block's license would both be wrong.
      const stub = detectTranscludeStub(rawContents);
      if (!stub) {
        return notTranscluded();
      }

      const tags = this.pageTags.get(this.pageTagsKey(library, pageID));
      // check if transcluded tag is set
      const transcludedTag = tags?.find((tag) =>
        tag["@value"].startsWith("transcluded:"),
      );
      if (!transcludedTag) {
        // if not add it to the page on cxone
        // The tag cache can be missing or stale, and a replace-write from it
        // would wipe the page's other tags. Merge into the live tags instead.
        await bookService.updatePageDetails(
          pageID,
          undefined,
          ["transcluded:yes"],
          { preserveExisting: true },
        );
      }

      const sourceTags =
        stub.kind === "cross-library"
          ? await this.getCachedPageTags(
              stub.subdomain,
              String(stub.pageID),
              `${stub.subdomain}-${stub.pageID}`,
            )
          : await this.getCachedPageTags(
              library,
              stub.path,
              `${library}-${pageID}`,
            );

      const licenseTag = sourceTags?.find((tag) =>
        tag["@value"].startsWith("license:"),
      );
      const licenseVersionTag = sourceTags?.find((tag) =>
        tag["@value"].startsWith("licenseversion:"),
      );
      if (licenseTag) {
        return {
          isTranscluded: true,
          sourceLicense: {
            label: licenseTag["@value"],
            raw: licenseVersionTag?.["@value"] ?? "",
            version: licenseVersionTag?.["@value"] ?? "",
          },
        };
      }

      return { isTranscluded: true, sourceLicense: undefined };
    } catch (error) {
      return notTranscluded();
    }
  }

  /**
   * Share of the page's text blocks that come from other pages: blocks with
   * another page's `lt-` class ÷ all text blocks. Blocks without one, or with
   * the page's own class (`lt-dev-1000` on `dev-1000`), are its own content.
   */
  private getQuotationRate(content: string, library: string, pageID: string): number {
    try {
      return ltQuotationRate(content, { lib: library, pageID: Number(pageID) });
    } catch (error) {
      return -1;
    }
  }

  private async getContentLicense(
    pageID: string,
    library: string,
    coverID: string,
  ): Promise<{
    contentLicenses:
      | { label: string; raw: string; version: string }[]
      | undefined;
    quotationRate: number;
    sourceLicense: { label: string; raw: string; version: string } | undefined;
  }> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });
    const page = await bookService.getPageContent(pageID, "json");

    if (!page) {
      return { contentLicenses: undefined, quotationRate: -1, sourceLicense: undefined };
    }
 
    // Other pages this page's content is attributed to. Its own `lt-` class
    // (`lt-dev-1000` on `dev-1000`) is not reuse, so its own license isn't
    // listed as a content license.
    const sources = parseLtClasses(page, { own: { lib: library, pageID: Number(pageID) } });

    const licenses: { label: string; raw: string; version: string }[] = [];

    for (const source of sources) {
      const license = await this.getPagelicense(String(source.pageID), source.lib, coverID, true);
      if (license) {
        licenses.push(license);
      }
    }
    const transcludedInfo = await this.isTranscluded(pageID, library);
    // Always the measured share, from the rendered content (where MindTouch
    // stamps embedded sections with their source's class). Only a page that is
    // wholly a pointer at another page is 100% by definition.
    const quotationRate = transcludedInfo.isTranscluded
      ? 1
      : this.getQuotationRate(page, library, pageID);

    const licenseMap = new Map<string, { label: string; raw: string; version: string }>();
    for (const license of licenses) {
      licenseMap.set(`${license.label}::${license.version}`, license);
    }
    const response = {
      contentLicenses: licenseMap.size > 0 ? Array.from(licenseMap.values()) : undefined,
      sourceLicense: transcludedInfo.sourceLicense,
      quotationRate,
    };
    return response;
  }
}

export default RestackerService;
