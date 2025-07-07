import { Request, Response } from "express";
import { debugError } from "../debug";
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
        debugError(error);
        return conductor500Err(res);
    }
}

export default {
    getClientConfig,
};