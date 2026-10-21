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

const authorshipLog = childLogger("authorship");

export const AUTHOR_TAG_PREFIX = "author@";
export const AUTHOR_NAME_TAG_PREFIX = "authorname:";

/**
 * The author tags of a page: every `author@` tag, or failing that its `authorname:` tag. A page
 * written by the Authorship tool has exactly one `author@<key>`; older pages may have several
 * `author@<Name>` tags or only an `authorname:<key>`.
 */
export function readAuthorTags(tagValues: string[]): AuthorshipAuthorRef[] {
  const authorTags = tagValues
    .filter((t) => t.startsWith(AUTHOR_TAG_PREFIX))
    .map((t) => t.slice(AUTHOR_TAG_PREFIX.length).trim())
    .filter(Boolean)
    .map((value) => ({ tag: "author@" as const, value }));
  if (authorTags.length > 0) return authorTags;

  const nameTag = tagValues
    .find((t) => t.startsWith(AUTHOR_NAME_TAG_PREFIX))
    ?.slice(AUTHOR_NAME_TAG_PREFIX.length)
    .trim();
  return nameTag ? [{ tag: "authorname:", value: nameTag }] : [];
}

/**
 * A page's tags with its `author@` tags replaced by `author@<authorKey>` (or removed when
 * `authorKey` is null). Every other tag, `authorname:` included, is kept as it is.
 */
export function replaceAuthorTag(tagValues: string[], authorKey: string | null): string[] {
  const kept = tagValues.filter((t) => !t.startsWith(AUTHOR_TAG_PREFIX));
  return authorKey ? [...kept, `${AUTHOR_TAG_PREFIX}${authorKey}`] : kept;
}

/** Distinct refs, in order of first appearance. */
const distinctRefs = (refs: AuthorshipAuthorRef[]): AuthorshipAuthorRef[] => {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const id = `${r.tag}${r.value}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

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
        const own = readAuthorTags(tags.map((t) => t["@value"]));
        page.pageAuthors = own.length ? own : undefined;

        const { sourceAuthor, contentAuthors } = await this.withRetry(() =>
          this.scanContent(library, coverID, page.id),
        );
        page.sourceAuthor = sourceAuthor;
        page.contentAuthors = contentAuthors.length ? contentAuthors : undefined;
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
   * Source author: for a page that is wholly a transclusion stub, the author tags of the page it
   * points at. Content authors: the author tags of every page referenced by `lt-<lib>-<id>`
   * content inside this page.
   */
  private async scanContent(
    library: string,
    coverID: string,
    pageID: string,
  ): Promise<{ sourceAuthor?: AuthorshipAuthorRef; contentAuthors: AuthorshipAuthorRef[] }> {
    const bookService = new BookService({ bookID: `${library}-${coverID}` });

    let sourceAuthor: AuthorshipAuthorRef | undefined;
    const raw = await bookService.getPageRawContent(pageID).catch(() => "");
    const stub = raw ? detectTranscludeStub(raw) : null;
    if (stub) {
      const sourceTags =
        stub.kind === "cross-library"
          ? await this.getTags(stub.subdomain, String(stub.pageID))
          : await this.getTags(library, stub.path);
      sourceAuthor = readAuthorTags(sourceTags.map((t) => t["@value"]))[0];
    }

    const contentAuthors: AuthorshipAuthorRef[] = [];
    const html = await bookService.getPageContent(pageID, "json").catch(() => null);
    if (html) {
      const ltRegex = new RegExp(this.ltRegex.source, this.ltRegex.flags);
      const refs = new Set([...String(html).matchAll(ltRegex)].map((m) => m[0]));
      for (const ref of refs) {
        const [, refLibrary, refPageID] = ref.split("-");
        const tags = await this.getTags(refLibrary, refPageID).catch(() => []);
        contentAuthors.push(...readAuthorTags(tags.map((t) => t["@value"])));
      }
    }

    return { sourceAuthor, contentAuthors: distinctRefs(contentAuthors) };
  }

  /** A few short retries for flaky library calls; the scan moves on after that. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const DELAYS_MS = [5_000, 15_000];
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= DELAYS_MS.length) throw err;
        await sleep(DELAYS_MS[attempt]);
      }
    }
  }
}

export default AuthorshipService;
