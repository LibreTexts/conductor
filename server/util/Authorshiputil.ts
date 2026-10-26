import { childLogger } from "../logger.js";
import Authorship, { AuthorshipInterface, AuthorshipPageStatus } from "../models/authorship.js";
import { randomUUID } from "node:crypto";

const authorshipLog = childLogger("authorship");

/**
 * The Attribution Manager's lock and status, mirroring the License Restacker's. Its pages are
 * scanned by the shared book scan (`util/book-scan.ts`), which fills both tools together.
 */
class AuthorshipService {
  static readonly LOCK_STALE_MS = 10 * 60_000;
  private static readonly LOCK_HEARTBEAT_MS = 60_000;

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
}

export default AuthorshipService;
