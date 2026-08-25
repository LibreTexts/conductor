import logger from "../logger.js";
import { Request, Response } from "express";
import { conductor500Err } from "../util/errorutils";
import ClientConfigService from "./services/client-config-service";


async function getClientConfig(req: Request, res: Response) {
    try {
        const clientConfigService = new ClientConfigService();
        const config = await clientConfigService.getConfig();
        if (!config) {
            return conductor500Err(res);
        }

        return res.status(200).json({
            err: false,
            data: config,
        });
    }
    catch (error) {
        logger.error({ err: error }, "getClientConfig failed");
        return conductor500Err(res);
    }
}

export default {
    getClientConfig,
};