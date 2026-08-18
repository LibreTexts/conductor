import { ShapeshiftJob, ShapeshiftJobStatus } from "../../types/Shapeshift";
import axios, { AxiosInstance } from "axios";
import { debugError } from "../../debug";
import Book from "../../models/book";

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
   * @param bookID - The ID of the book to update.
   * @param timestamp - The timestamp of the webhook event.
   * @returns - A string indicating the result of the operation: 'success', 'not_found', 'invalid_timestamp', or 'error'.
   */
  public async handleWebhook(bookID: string, timestamp: number): Promise<'success' | 'not_found' | 'invalid_timestamp' | 'error'> {
    try {
      const acceptedSkew = 5 * 60 * 1000; // 5 minutes in milliseconds
      const currentTime = Date.now();

      // Accept the webhook if the timestamp is plus or minus 5 minutes from the current time
      if (Math.abs(currentTime - timestamp) > acceptedSkew) {
        debugError(`Timestamp for Shapeshift webhook is too skewed. Received: ${timestamp}, Current: ${currentTime}`);
        return 'invalid_timestamp';
      }

      const book = await Book.updateOne({ bookID: { $eq: bookID } }, {
        $set: { isCompiled: true },
        $max: { lastCompiled: timestamp }, // Only update lastCompiled if the new timestamp is greater than the existing value
      });

      if (!book || book.matchedCount === 0) {
        debugError(`Book with bookID ${bookID} not found for Shapeshift webhook.`);
        return 'not_found';
      }

      return 'success';
    } catch (error) {
      debugError(error);
      return 'error';
    }
  }
}