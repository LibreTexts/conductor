import { childLogger } from "../logger.js";
import BookService from "../api/services/book-service.js";
import Authorship, {
  AuthorshipAuthorRef,
  AuthorshipInterface,
  AuthorshipPageStatus,
} from "../models/authorship.js";
import { PageTag } from "../types/Book.js";
import { randomUUID } from "node:crypto";
import { sleep } from "./helpers.js";
import { libraryKeys } from "./libraries.js";
import { detectTranscludeStub } from "./transclusion.js";
import { distinctCreditRefs, readAllCreditTags } from "./author-tags.js";

const authorshipLog = childLogger("authorship");

/**
 * Scans a book's pages for their author tags, mirroring the License Restacker's design: a
 * per-project document, a `processing` lock with a heartbeat, and progress flushed in batches so
 * a pollable status endpoint reflects it. Kept separate from RestackerService so neither tool can
 * disturb the other's runs.
 */
class AuthorshipService {
  private pageTags = new Map<string, PageTag[]>();

  private static readonly PERSIST_BATCH_SIZE = 10;
  private static readonly CONCURRENCY = 3;
  static readonly LOCK_STALE_MS = 10 * 60_000;
  private static readonly LOCK_HEARTBEAT_MS = 60_000;

  private ltRegex = new RegExp(`\\blt-(${libraryKeys})-\\d+\\b`, "g");

  /** True while a live run holds the project's `processing` lock. */
  static isLockActive(
    doc: Pick<AuthorshipInterface, "processing" | "processingHeartbeatAt"> | null | undefined,
  ): boolean {
    if (!doc?.processing || !doc.processingHeartbeatAt) return false;
    return (
      Date.now() - new Date(doc.processingHeartbeatAt).getTime() <
      AuthorshipService.LOCK_STALE_MS
    );
  }

  /** Atomically takes the lock if it is free or stale. Returns its ID, or null if held. */
  static async acquireLock(projectID: string): Promise<string | null> {
    const now = new Date();
    const lockID = randomUUID();
    const result = await Authorship.updateOne(
      {
        projectID: { $eq: projectID },
        $or: [
          { processing: { $ne: true } },
          { processingHeartbeatAt: { $exists: false } },
          {
            processingHeartbeatAt: {
              $lt: new Date(now.getTime() - AuthorshipService.LOCK_STALE_MS),
            },
          },
        ],
      },
      { $set: { processing: true, processingLockID: lockID, processingHeartbeatAt: now } },
    );
    return result.modifiedCount === 1 ? lockID : null;
  }

  static async releaseLock(projectID: string, lockID: string) {
    await Authorship.updateOne(
      { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
      {
        $set: { processing: false },
        $unset: { processingLockID: "", processingHeartbeatAt: "" },
      },
    );
  }

  /** Runs `fn` while keeping the lock's heartbeat fresh, then releases the lock. */
  static async withLock<T>(projectID: string, lockID: string, fn: () => Promise<T>): Promise<T> {
    const heartbeat = setInterval(() => {
      Authorship.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        { $set: { processingHeartbeatAt: new Date() } },
      ).catch((err) => {
        authorshipLog.warn({ err, projectID }, "Failed to refresh authorship lock heartbeat");
      });
    }, AuthorshipService.LOCK_HEARTBEAT_MS);
    try {
      return await fn();
    } finally {
      clearInterval(heartbeat);
      await AuthorshipService.releaseLock(projectID, lockID);
    }
  }

  getStatus(doc: AuthorshipInterface | null) {
    if (!doc) return { statusCode: "notfound" as const };
    const total = doc.pages.length;
    const pending = doc.pages.filter((p) => p.status === "pending").length;
    const failed = doc.pages.filter((p) => p.status === "failed").length;
    const counts = {
      processing: AuthorshipService.isLockActive(doc),
      total,
      pending,
      failed,
      completed: total - pending - failed,
    };
    const statusCode: AuthorshipPageStatus =
      pending > 0 ? "pending" : failed > 0 ? "failed" : "completed";
    return { statusCode, ...counts };
  }

  /** Scans every pending page. Takes the lock itself unless the caller hands one over. */
  async run(projectID: string, library: string, coverID: string, heldLockID?: string) {
    const lockID = heldLockID ?? (await AuthorshipService.acquireLock(projectID));
    if (!lockID) {
      authorshipLog.info({ projectID }, "Authorship scan skipped; another run holds the lock");
      return;
    }
    await AuthorshipService.withLock(projectID, lockID, () =>
      this.processPendingPages(projectID, library, coverID, lockID),
    );
  }

  private async processPendingPages(
    projectID: string,
    library: string,
    coverID: string,
    lockID: string,
  ) {
    const doc = await Authorship.findOne({ projectID: { $eq: projectID } });
    if (!doc) throw new Error("Authorship not found");
    const pages = doc.pages;

    // Filtered on the lock ID so a superseded run can't overwrite a newer run's progress.
    const flush = () =>
      Authorship.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        { $set: { pages } },
      );

    const processPage = async (page: (typeof pages)[number]) => {
      if (page.status !== "pending") return;
      try {
        const tags = await this.withRetry(() => this.getTags(library, page.id));
        const own = readAllCreditTags(tags.map((t) => t["@value"]));
        page.pageCredits = own.length ? own : undefined;

        const { sourceCredits, contentCredits } = await this.withRetry(() =>
          this.scanContent(library, coverID, page.id),
        );
        page.sourceCredits = sourceCredits.length ? sourceCredits : undefined;
        page.contentCredits = contentCredits.length ? contentCredits : undefined;
        page.status = "completed";
      } catch (err) {
        authorshipLog.warn({ err, projectID, pageID: page.id }, "Authorship scan failed for page");
        page.status = "failed";
      }
    };

    let sinceFlush = 0;
    for (let i = 0; i < pages.length; i += AuthorshipService.CONCURRENCY) {
      const chunk = pages.slice(i, i + AuthorshipService.CONCURRENCY);
      await Promise.all(chunk.map(processPage));
      sinceFlush += chunk.length;
      if (sinceFlush >= AuthorshipService.PERSIST_BATCH_SIZE) {
        await flush();
        sinceFlush = 0;
      }
    }
    await flush();
  }

  private async getTags(library: string, pageID: string): Promise<PageTag[]> {
    const key = `${library}:${pageID}`;
    const cached = this.pageTags.get(key);
    if (cached) return cached;
    const tags = await new BookService({ bookID: `${library}-${pageID}` }).getPageTags(pageID);
    this.pageTags.set(key, tags);
    return tags;
  }

  /**
   * Source credits: for a page that is wholly a transclusion stub, the credit tags of the page it
   * points at. Content credits: the credit tags of every page referenced by `lt-<lib>-<id>`
   * content inside this page. Every role is collected.
   */
  private async scanContent(
    library: string,
    coverID: string,
    pageID: string,
  ): Promise<{ sourceCredits: AuthorshipAuthorRef[]; contentCredits: AuthorshipAuthorRef[] }> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });

    // Read failures propagate, so the page is retried and then marked failed instead of being
    // recorded as having no source or content authors.
    let sourceCredits: AuthorshipAuthorRef[] = [];
    const raw = await bookService.getPageRawContent(pageID);
    const stub = raw ? detectTranscludeStub(raw) : null;
    if (stub) {
      const sourceTags =
        stub.kind === "cross-library"
          ? await this.getTags(stub.subdomain, String(stub.pageID))
          : await this.getTags(library, stub.path);
      sourceCredits = readAllCreditTags(sourceTags.map((t) => t["@value"]));
    }

    const contentCredits: AuthorshipAuthorRef[] = [];
    const html = await bookService.getPageContent(pageID, "json");
    if (html) {
      const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);
      const refs = new Set([...String(html).matchAll(ltRegex)].map((m) => m[0]));
      for (const ref of refs) {
        const [, refLibrary, refPageID] = ref.split("-");
        // A referenced page can legitimately be unreadable (deleted, or private in another
        // library); that shouldn't fail this page, so it is just left out.
        const tags = await this.getTags(refLibrary, refPageID).catch((err) => {
          authorshipLog.debug({ err, ref }, "Could not read tags of reused content");
          return [] as PageTag[];
        });
        contentCredits.push(...readAllCreditTags(tags.map((t) => t["@value"])));
      }
    }

    return { sourceCredits, contentCredits: distinctCreditRefs(contentCredits) };
  }

  /**
   * Retries transient library failures (timeouts, dropped connections, 5xx) a couple of times.
   * Anything else, such as a 403 or 404, fails the page straight away instead of waiting.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const DELAYS_MS = [5_000, 15_000];
    const isTransient = (err: unknown) => {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      return (
        /timeout|timed out|etimedout|econnreset|socket hang up|transient error/.test(msg) ||
        /\b5\d\d\b/.test(msg)
      );
    };
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= DELAYS_MS.length || !isTransient(err)) throw err;
        await sleep(DELAYS_MS[attempt]);
      }
    }
  }
}

export default AuthorshipService;
