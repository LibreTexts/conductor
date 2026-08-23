import { ShapeshiftJob, ShapeshiftJobStatus } from "../../types/Shapeshift.js";
import axios, { AxiosInstance } from "axios";
import { debugCommonsSync, debugError } from "../../debug.js";
import Book from "../../models/book.js";
import { z } from "zod";
import { WebhookValidator } from "../validators/shapeshift.js";
import { syncSingleBook } from "./book-sync-service.js";
import { upsertBookToSearchIndex } from "./book-search-service.js";

type WebhookParams = z.infer<typeof WebhookValidator>["body"];

/**
 * Books whose live sync is already running in this process.
 *
 * A compile can produce several deliveries for the same book in quick
 * succession; without this, each would open its own set of library requests for
 * a page whose data is already being fetched.
 */
const inFlightSyncs = new Set<string>();

export default class ShapeshiftService {
  private instance: AxiosInstance;
  private authHeader = `Bearer ${process.env.SHAPESHIFT_API_KEY}`;

  constructor() {
    this.instance = axios.create({
      baseURL: `https://${process.env.SHAPESHIFT_HOST}/api/v1`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.authHeader,
      },
    });
  }

  public async createJob({ highPriority, url }: { highPriority?: boolean; url: string }): Promise<string | null> {
    try {
      const resp = await this.instance.post('/job', {
        highPriority,
        url,
      });
      if (resp?.status !== 200 || !resp?.data?.data?.id) return null;
      return resp.data.data.id;
    } catch (error) {
      debugError(error);
      return null;
    }
  }

  public async getOpenJobs(params: {
    limit?: number;
    offset?: number;
    sort?: 'asc' | 'desc';
    status?: ShapeshiftJobStatus[];
  }): Promise<{ meta: { offset: number; limit: number; total: number }; jobs: ShapeshiftJob[]; }> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    const emptyResponse = {
      meta: {
        limit,
        offset,
        total: 0,
      },
      jobs: [],
    };
    try {
      const resp = await this.instance.get('/jobs', {
        params: {
          limit,
          offset,
          sort: params.sort,
          status: params.status,
        },
      });
      if (!resp?.data?.meta?.total) return emptyResponse;
      return {
        jobs: resp.data.data as ShapeshiftJob[],
        meta: resp.data.meta,
      };
    } catch (error) {
      debugError(error);
      return emptyResponse;
    }
  }

  /**
   * Writes compilation status, but only over older data.
   *
   * `$lte` (not `<`) makes a redelivery of the same timestamp an idempotent
   * no-op write. Matching `null` covers both a missing `exportInfo` and a
   * missing `lastCompiled`.
   *
   * @returns Whether a Book matched and therefore carries this data now.
   */
  private async applyCompileStatus({
    bookID,
    contentPageCount,
    timestamp,
  }: WebhookParams): Promise<boolean> {
    const result = await Book.updateOne(
      {
        bookID: { $eq: bookID },
        $or: [
          { "exportInfo.lastCompiled": null },
          { "exportInfo.lastCompiled": { $lte: timestamp } },
        ],
      },
      {
        $set: {
          "exportInfo.isCompiled": true,
          "exportInfo.lastCompiled": timestamp,
          "exportInfo.compiledBy": "shapeshift",
          ...(contentPageCount !== undefined
            ? { "exportInfo.contentPageCount": contentPageCount }
            : {}),
        },
      }
    );

    return result.matchedCount > 0;
  }

  /**
   * Runs a live library sync for the book, detached from the request.
   *
   * Nothing here can reject into the caller: a library that is slow, down, or
   * returning nonsense must not affect the compilation status write that has
   * already landed, nor the response the webhook sender is waiting on.
   *
   * When the sync creates a Book that did not exist a moment ago, the
   * compilation data from this delivery is applied to it — it had nothing to
   * attach to on the first attempt.
   *
   * The search index is refreshed last, once every write this delivery makes has
   * landed. Indexing from inside `syncSingleBook` would be too early: on the
   * `ingested` path the compilation status is written after it returns, so the
   * document would go to Meilisearch without its `exportInfo`.
   */
  private queueLiveSync(params: WebhookParams): void {
    const { bookID } = params;
    if (inFlightSyncs.has(bookID)) {
      debugCommonsSync(`Live sync for ${bookID} already running — skipping.`);
      /* The run already in flight will refresh the library data, but it may have
         read the Book before this delivery's compilation status landed. That
         write is already awaited by the caller, so indexing here is safe and
         picks it up. */
      void upsertBookToSearchIndex(bookID);
      return;
    }
    inFlightSyncs.add(bookID);

    void (async () => {
      try {
        const outcome = await syncSingleBook(bookID);
        if (outcome.status === "ingested") {
          await this.applyCompileStatus(params);
        }
        if ("reason" in outcome) {
          debugCommonsSync(
            `Live sync for ${bookID} finished as ${outcome.status}: ${outcome.reason}`
          );
        }

        /* Every Mongo write from this delivery has landed — publish the result to
           Commons search now instead of waiting for the next full re-sync. Runs
           even when the sync was skipped or errored, because the compilation
           status write may still have changed the stored Book. Never throws. */
        await upsertBookToSearchIndex(bookID);
      } catch (error) {
        debugError(error);
      } finally {
        inFlightSyncs.delete(bookID);
      }
    })();
  }

  /**
   * Handle a webhook from Shapeshift to update the book's compilation status.
   *
   * The update is applied as a single conditional, atomic document operation, so concurrent
   * deliveries cannot lose data: an older timestamp (or its page count) can never overwrite a
   * newer one. A redelivery carrying the timestamp already stored is an idempotent 'success';
   * a delivery older than what is stored is ignored and reported as 'stale'.
   *
   * Every accepted delivery also queues a live library sync for the book, so a compile
   * refreshes the book's catalog data instead of waiting for the nightly run — and so a book
   * Commons has never seen can be ingested on the spot if it is eligible. That work runs after
   * the response and its outcome is not reflected here; an unknown bookID reports 'accepted'
   * whether or not the book turns out to be ingestable.
   *
   * @param params - The parameters from the webhook, including bookID, contentPageCount, and timestamp.
   * @returns - A string indicating the result of the operation: 'success', 'stale', 'accepted', 'invalid_timestamp', or 'error'.
   */
  public async handleWebhook(params: WebhookParams): Promise<'success' | 'stale' | 'accepted' | 'invalid_timestamp' | 'error'> {
    try {
      const acceptedSkew = 5 * 60 * 1000; // 5 minutes in milliseconds
      const currentTime = Date.now();

      const { bookID, timestamp } = params;

      // Accept the webhook if the timestamp is plus or minus 5 minutes from the current time
      if (Math.abs(currentTime - timestamp) > acceptedSkew) {
        debugError(`Timestamp for Shapeshift webhook is too skewed. Received: ${timestamp}, Current: ${currentTime}`);
        return 'invalid_timestamp';
      }

      const applied = await this.applyCompileStatus(params);

      // Whatever the compilation write did, the library data behind this book is
      // worth refreshing — that is the point of reacting to a compile at all.
      this.queueLiveSync(params);

      if (applied) return 'success';

      // No match: either the book does not exist, or a newer compilation is already recorded.
      const exists = await Book.exists({ bookID: { $eq: bookID } });
      if (!exists) {
        debugCommonsSync(`Book ${bookID} is unknown to Commons — queued a live library sync.`);
        return 'accepted';
      }

      debugError(`Ignoring stale Shapeshift webhook for ${bookID}. Received timestamp ${timestamp}, newer compilation already recorded.`);
      return 'stale';
    } catch (error) {
      debugError(error);
      return 'error';
    }
  }
}
