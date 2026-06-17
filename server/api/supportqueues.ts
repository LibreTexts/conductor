import { Request, Response } from "express";
import { z } from "zod";
import { getMetricsSchema, getSupportQueuesSchema, updateAutoAssignConfigSchema } from "./validators/supportqueues";
import { debugError } from "../debug";
import { conductor500Err } from "../util/errorutils";
import SupportQueueService from "./services/support-queue-service";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import authAPI from "./auth";


async function getSupportQueues(req: ZodReqWithOptionalUser<z.infer<typeof getSupportQueuesSchema>>, res: Response) {
    try {
        const service = new SupportQueueService();
        const withCount = req.query?.with_count || false;
        const isSupportUser = req.user && authAPI.checkHasRole(req.user, "libretexts", "support");

        // User must have support role to view ticket counts
        if (withCount && !isSupportUser) {
            return res.status(403).json({ err: true, errMsg: "Forbidden" });
        }

        const queues = await service.getQueues({ withCount, visibleOnly: !isSupportUser });
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

async function getAutoAssignConfig(req: ZodReqWithUser<Request>, res: Response) {
    try {
        const service = new SupportQueueService();
        const queues = await service.getQueuesWithAutoAssignConfig();
        return res.status(200).json({ err: false, queues });
    } catch (error) {
        debugError(error);
        return conductor500Err(res);
    }
}

async function updateAutoAssignConfig(req: ZodReqWithUser<z.infer<typeof updateAutoAssignConfigSchema>>, res: Response) {
    try {
        const { id } = req.params;
        const { auto_assign_enabled, auto_assign_uuids } = req.body;

        const service = new SupportQueueService();
        const updated = await service.updateAutoAssignConfig(id, {
            auto_assign_enabled,
            auto_assign_uuids,
        });

        if (!updated) {
            return res.status(404).json({ err: true, errMsg: "Queue not found" });
        }

        return res.status(200).json({ err: false, queue: updated });
    } catch (error) {
        debugError(error);
        return conductor500Err(res);
    }
}

export default {
    getSupportQueues,
    getSupportQueueMetrics,
    getAutoAssignConfig,
    updateAutoAssignConfig
};