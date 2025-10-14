import { Request, Response } from "express";
import { z } from "zod";
import { getMetricsSchema, getSupportQueueSchema, getSupportQueuesSchema } from "./validators/supportqueues";
import { debugError } from "../debug";
import { conductor404Err, conductor500Err } from "../util/errorutils";
import SupportQueueService from "./services/support-queue-service";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import authAPI from "./auth";


async function getSupportQueues(req: ZodReqWithOptionalUser<z.infer<typeof getSupportQueuesSchema>>, res: Response) {
    try {
        const service = new SupportQueueService();

        // @ts-expect-error
        const withCount = req.query?.with_count === true || req.query?.with_count === "true";

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

async function getSupportQueue(req: ZodReqWithOptionalUser<z.infer<typeof getSupportQueueSchema>>, res: Response) {
    try {
        const { slug } = req.params;

        // @ts-expect-error
        const withCount = req.query?.with_count === true || req.query?.with_count === "true";

        // User must have support role to view ticket counts
        if (withCount && (!req.user || !authAPI.checkHasRole(req.user, "libretexts", "support"))) {
            return res.status(403).json({ err: true, errMsg: "Forbidden" });
        }

        const service = new SupportQueueService();
        const queue = await service.getQueueBySlug(slug, { withCount });
        if (!queue) {
            return conductor404Err(res);
        }

        return res.status(200).json({ err: false, queue });
    } catch (error) {
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
    getSupportQueue,
    getSupportQueueMetrics
};