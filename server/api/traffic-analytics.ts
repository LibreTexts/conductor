import { Request, Response } from 'express';
import TrafficAnalyticsService from "./services/traffic-analytics/traffic-analytics-service";

export async function bulkSyncSegmentsForAllLibraries(_req: Request, res: Response) {
  const service = new TrafficAnalyticsService();
  await service.bulkSyncSegmentsForAllLibraries();
  res.send({ err: false, data: null });
}
