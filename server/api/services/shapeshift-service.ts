import { ShapeshiftJob, ShapeshiftJobStatus } from "../../types/Shapeshift";
import axios, { AxiosInstance } from "axios";
import { debugError } from "../../debug";
import Book from "../../models/book";
import { z } from "zod";
import { WebhookValidator } from "../validators/shapeshift";

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
   * Handle a webhook from Shapeshift to update the book's compilation status.
   *
   * The update is applied as a single conditional, atomic document operation, so concurrent
   * deliveries cannot lose data: an older timestamp (or its page count) can never overwrite a
   * newer one. A redelivery carrying the timestamp already stored is an idempotent 'success';
   * a delivery older than what is stored is ignored and reported as 'stale'.
   * @param params - The parameters from the webhook, including bookID, contentPageCount, and timestamp.
   * @returns - A string indicating the result of the operation: 'success', 'stale', 'not_found', 'invalid_timestamp', or 'error'.
   */
  public async handleWebhook(params: z.infer<typeof WebhookValidator>["body"]): Promise<'success' | 'stale' | 'not_found' | 'invalid_timestamp' | 'error'> {
    try {
      const acceptedSkew = 5 * 60 * 1000; // 5 minutes in milliseconds
      const currentTime = Date.now();

      const { bookID, contentPageCount, timestamp } = params;

      // Accept the webhook if the timestamp is plus or minus 5 minutes from the current time
      if (Math.abs(currentTime - timestamp) > acceptedSkew) {
        debugError(`Timestamp for Shapeshift webhook is too skewed. Received: ${timestamp}, Current: ${currentTime}`);
        return 'invalid_timestamp';
      }

      // Atomically apply the update only if no newer compilation has already been recorded.
      // `$lte` (not `<`) makes a redelivery of the same timestamp an idempotent no-op write.
      // Matching `null` covers both a missing `exportInfo` and a missing `lastCompiled`.
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
            ...(contentPageCount !== undefined
              ? { "exportInfo.contentPageCount": contentPageCount }
              : {}),
          },
        }
      );

      if (result.matchedCount > 0) return 'success';

      // No match: either the book does not exist, or a newer compilation is already recorded.
      const exists = await Book.exists({ bookID: { $eq: bookID } });
      if (!exists) {
        debugError(`Book with bookID ${bookID} not found for Shapeshift webhook.`);
        return 'not_found';
      }

      debugError(`Ignoring stale Shapeshift webhook for ${bookID}. Received timestamp ${timestamp}, newer compilation already recorded.`);
      return 'stale';
    } catch (error) {
      debugError(error);
      return 'error';
    }
  }
}