//
// LibreTexts Conductor
// http-logger.ts
//
// Access logging for the API routers. Mounted alongside `requestContext` so the
// per-request completion line shares its `reqId` with every application log line the
// request produced.
//

import pinoHttp from "pino-http";
import type { Request } from "express";
import logger from "./logger.js";

export const httpLogger = pinoHttp({
  logger,
  // `requestContext` already resolved the id; reusing it is what ties the two together.
  genReqId: (req) => (req as Request & { id?: string }).id as string,
  // pino-http's default is to log a completed request at `info` regardless of outcome.
  // Splitting by status keeps `level = "error"` meaningful for alerting.
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  autoLogging: {
    // The ECS/ALB health check runs continuously and says nothing useful.
    ignore: (req) => req.url === "/health" || req.url?.startsWith("/health?") === true,
  },
  // The request/response bindings are already covered by the `requestContext` mixin, and
  // pino-http's defaults would otherwise repeat the full header set on every line.
  serializers: {
    req: (req) => ({ url: req.url, remoteAddress: req.remoteAddress }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

export default httpLogger;
