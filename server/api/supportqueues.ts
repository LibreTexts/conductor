import { Response } from "express";
import { z } from "zod";
import { getMetricsSchema, getSupportQueuesSchema } from "./validators/supportqueues";
import { debugError } from "../debug";
import { conductor500Err } from "../util/errorutils";
import SupportQueueService from "./services/support-queue-service";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import authAPI from "./auth";


async function getSupportQueues(req: ZodReqWithOptionalUser<z.infer<typeof getSupportQueuesSchema>>, res: Response) {
    try {
        const service = new SupportQueueService();
        const withCount = req.query?.with_count || false;

        // User must have support role to view ticket counts
        if (withCount && (!req.user || !authAPI.checkHasRole(req.user, "libretexts", "support"))) {
            return res.status(403).json({ err: true, errMsg: "Forbidden" });
        }

        const queues = await service.getQueues({ withCount });
        return res.status(200).json({
            err: false,
            queues,
        });
    }
    catch (error) {
        debugError(error);
        return conductor500Err(res);
    }
}

async function getSupportQueueMetrics(req: ZodReqWithUser<z.infer<typeof getMetricsSchema>>, res: Response) {
    try {
        const { slug } = req.params;

        const service = new SupportQueueService();
        const metrics = await service.getMetrics(slug);

        return res.status(200).json({ err: false, metrics: { ...metrics } });
    } catch (error) {
        debugError(error);
        return conductor500Err(res);
    }
}

export default {
    getSupportQueues,
    getSupportQueueMetrics
};