import { childLogger } from "../logger.js";
import Restacker, { RestackerInterface, RestackerStatus } from "../models/restacker.js";
import { randomUUID } from "node:crypto";
const restackerLog = childLogger("restacker");

export type RestackerRefreshMode = "content" | "page";

/**
 * The Restacker's lock and status. Its pages are scanned by the shared book scan
 * (`util/book-scan.ts`), which fills the Restacker and the Attribution Manager together.
 */
class RestackerService {
  /**
   * A `processing` lock whose heartbeat is older than this is treated as abandoned
   * (the holder crashed or was redeployed mid-run). The heartbeat runs on a timer,
   * not per page, so a page stuck in a retry backoff can't age it out.
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
}

export default RestackerService;
