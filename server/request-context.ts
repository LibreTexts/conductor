//
// LibreTexts Conductor
// request-context.ts
//
// Request-scoped logging context. An AsyncLocalStorage store is entered once per
// API request so that every log line emitted anywhere beneath that request — however
// many awaits deep — carries the same correlation fields without them being threaded
// through function signatures. `getRequestBindings` is wired into the pino logger as
// its `mixin`, which is what makes that automatic.
//

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface RequestContextStore {
  reqId: string;
  /** Kept so `route` can be resolved lazily — Express only populates `req.route` once a handler matches. */
  req: Request;
  userUUID?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/**
 * Resolves the id to correlate this request under. Prefers an id already assigned
 * upstream so a Conductor log line can be joined to the ALB/Cloudflare record for the
 * same request; falls back to generating one.
 *
 * Safe to trust because the only path to this process is through the load balancer.
 */
function resolveRequestId(req: Request): string {
  const amznTrace = req.headers["x-amzn-trace-id"];
  if (typeof amznTrace === "string" && amznTrace.length > 0) return amznTrace;

  const requestId = req.headers["x-request-id"];
  if (typeof requestId === "string" && requestId.length > 0) return requestId;

  return randomUUID();
}

/**
 * Express middleware that opens the request-scoped logging context. Mount this ahead of
 * any router whose logs should be correlated.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const reqId = resolveRequestId(req);
  // pino-http reads `req.id` to label its access log line; setting it here keeps the
  // access log and the application logs on the same identifier.
  (req as Request & { id?: string }).id = reqId;
  storage.run({ reqId, req }, () => next());
}

/**
 * Attaches the authenticated user to the current request's logging context. Called from
 * the auth middleware once a token has been verified, so every log line after that point
 * identifies the actor.
 */
export function setRequestUser(userUUID: string | undefined) {
  const store = storage.getStore();
  if (store && userUUID) store.userUUID = userUUID;
}

/**
 * The pino `mixin`. Runs on every single log call, so it stays allocation-light and never
 * throws; outside a request (boot, migrations, background jobs) it contributes nothing.
 */
export function getRequestBindings(): Record<string, string> {
  const store = storage.getStore();
  if (!store) return {};

  const { reqId, req, userUUID } = store;
  const bindings: Record<string, string> = { reqId, method: req.method };

  // The parameterised path (`/projects/:projectID`), not the interpolated URL, so that
  // logs for one endpoint group together instead of fanning out per id. Only available
  // after Express has matched a route, hence resolving it here rather than at entry.
  const route = req.route?.path;
  bindings.route = route ? `${req.baseUrl}${route}` : req.originalUrl;

  if (userUUID) bindings.userUUID = userUUID;
  return bindings;
}

export default requestContext;
