import {ShapeshiftJob, ShapeshiftJobStatus} from "../../types/Shapeshift";
import axios, {AxiosInstance} from "axios";
import {debugError} from "../../debug";

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

  public async getOpenJobs({ sort, status }: { sort?: 'asc' | 'desc'; status?: ShapeshiftJobStatus }): Promise<ShapeshiftJob[]> {
    try {
      const resp = await this.instance.get('/jobs', {
        params: {
          sort,
          status,
        },
      });
      if (!resp?.data?.data?.length) return [];
      return resp.data?.data as ShapeshiftJob[];
    } catch (error) {
      debugError(error);
      return [];
    }
  }
}