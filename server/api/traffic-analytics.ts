import { Request, Response } from 'express';
import TrafficAnalyticsService from "./services/traffic-analytics/traffic-analytics-service";
import { conductor500Err } from '../util/errorutils';
import { debugError } from '../debug';

export async function bulkSyncSegmentsForAllLibraries(_req: Request, res: Response) {
  try {
    const service = new TrafficAnalyticsService();

    res.send({
      err: false,
      msg: "Bulk sync of traffic analytics segments for all libraries has been initiated. This process will run in the background.",
      data: null
    });

    service.bulkSyncSegmentsForAllLibraries().catch((error) => {
      debugError(`Error during bulk sync of traffic analytics segments: ${error}`);
    });
  } catch (error) {
    debugError(error);
    if (!res.headersSent) {
      return conductor500Err(res);
    }
  }
}
