//
// LibreTexts Conductor
// logger.ts
//
// The single logging entry point for the server. Import the default export and call
// `logger.<level>({ ...fields }, "message")` — bindings first, human-readable message
// last. Errors always go under the `err` key so pino's standard serializer records the
// type, message, and stack.
//
// Output is one line of JSON per event on stdout, shaped for CloudWatch Logs Insights:
// string level labels (`filter level = "error"`), an ISO timestamp, and no pid/hostname
// (the awslogs stream already identifies the task). `orgID` is deliberately absent —
// every org runs as its own ECS service with its own log stream.
//

import pino from "pino";
import { getRequestBindings } from "./request-context.js";

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  // Drops pid and hostname. In ECS the hostname is an opaque container id and the task
  // is already identified by the log stream name.
  base: undefined,
  // CloudWatch's own @timestamp is ingestion time; this is the event time you correlate on.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // "error", not 50 — Logs Insights filters read far better against the label.
    level: (label) => ({ level: label }),
  },
  // Adds reqId/method/route/userUUID when running inside a request; nothing otherwise.
  mixin: getRequestBindings,
  redact: {
    // A `*.x` path matches one level down and NOT the root, so each key is listed both
    // ways. Even so this is a pragmatic net rather than a guarantee — pino does not walk
    // arbitrary depth — so secrets still must not be put into log bindings by hand.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      ...[
        "password",
        "token",
        "secret",
        "apiKey",
        "accessToken",
        "refreshToken",
        "client_secret",
      ].flatMap((key) => [key, `*.${key}`]),
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Tags a logger with the subsystem it belongs to. Prefer this over prefixing messages:
 * `component` is a queryable field, `"[COMMONS SYNC]: ..."` is not.
 *
 * @example const log = childLogger("commons-sync");
 */
export const childLogger = (component: string) => logger.child({ component });

export default logger;
