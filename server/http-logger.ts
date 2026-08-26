//
// LibreTexts Conductor
// http-logger.ts
//
// Access logging for the API routers. Mounted alongside `requestContext` so the
// per-request completion line shares its `reqId` with every application log line the
// request produced.
//

import pinoHttp, { startTime } from "pino-http";
import type { Request } from "express";
import type { ServerResponse } from "node:http";
import logger from "./logger.js";

/**
 * Requests slower than this still log at `info` even when they succeed — a 200 that took
 * eight seconds is exactly the event you want surfaced without turning `debug` on.
 */
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 2000);

/**
 * Opt-in for the full access log: one line per request including fast successes.
 *
 * Deliberately a separate switch rather than a level. `LOG_LEVEL=debug` is routinely set
 * in production to trace an issue, and the per-request completion line is the one piece of
 * `debug` output that is pure volume — it drowns the application `debug` lines that are the
 * actual reason for turning `debug` on. Suppressing it is therefore not a level decision,
 * and this stays orthogonal to `LOG_LEVEL`: set both to get genuinely everything.
 */
const logSuccessfulRequests = process.env.LOG_HTTP_SUCCESS === "true";

/**
 * Elapsed time for a request, read off the same start marker pino-http uses for its own
 * `responseTime` field. Returns 0 if the marker is missing (nothing upstream set it),
 * which simply means the slow-request rule never fires — never a wrong level.
 */
function elapsedMs(res: ServerResponse): number {
  const started = (res as ServerResponse & { [startTime]?: number })[startTime];
  return typeof started === "number" ? Date.now() - started : 0;
}

export const httpLogger = pinoHttp({
  logger,
  // `requestContext` already resolved the id; reusing it is what ties the two together.
  genReqId: (req) => (req as Request & { id?: string }).id as string,
  // pino-http's default is to log a completed request at `info` regardless of outcome,
  // which buries the lines that actually need a human under one entry per request.
  // Failures keep their own levels so `level = "error"` stays meaningful for alerting, and
  // slow successes still surface at `info` so latency stays visible. Everything left over —
  // a fast 2xx/3xx, i.e. the overwhelming majority of traffic — is dropped entirely rather
  // than demoted, so it stays out of the way even under `LOG_LEVEL=debug`.
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    if (elapsedMs(res) >= SLOW_REQUEST_MS) return "info";
    return logSuccessfulRequests ? "debug" : "silent";
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
