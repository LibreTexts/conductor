import { NextFunction, Request, Response } from "express";
import { childLogger } from "../logger.js";

const log = childLogger("adapt-integration");

/**
 * Keeps non-production Conductor away from ADAPT, in both directions.
 *
 * Staging holds a pseudonymised copy of production: real activities, fake
 * people. If ADAPT ever read it (through a misrouted Worker or a copied
 * hostname), synthetic authors and ADAPT ids would flow into real courses. If
 * staging ever wrote to ADAPT, it would act on real course data. Both are the
 * intermingling the migration's staging phase exists to prevent (runbook,
 * Phase 2 step 2).
 *
 * Applies to everything H5P-related Conductor exchanges with ADAPT:
 * - `/commons/activities-adapt-feed`, the reconciliation feed;
 * - `/studio/*`, the replacements for the Studio API ADAPT calls;
 * - the job that will replace Studio's id sync with ADAPT, once built: it
 *   must call `assertAdaptIntegrationAllowed()` before contacting ADAPT.
 *
 * Two independent guards, because each alone has a hole:
 * - Environment: outside `APP_ENV=production` these endpoints answer 404,
 *   unless `ADAPT_FEEDS_OUTSIDE_PRODUCTION=true` reopens them deliberately,
 *   for diffing the Studio replacements on staging.
 * - Data: in production they serve only records stamped
 *   `dataClass: "production"`. Conductor treats an unset `APP_ENV` as
 *   production, so a staging instance missing that variable would pass the
 *   first guard; it would still find no production records to hand over.
 *
 * Conductor's homework and analytics syncs with ADAPT predate the migration,
 * carry no H5P data, and are not affected.
 */

/** Same rule as `Activity.dataClass`'s default: unset means production. */
export function isProductionEnvironment(): boolean {
  return (process.env.APP_ENV ?? "production") === "production";
}

/** Whether this instance may exchange H5P data with ADAPT at all. */
export function adaptIntegrationAllowed(): boolean {
  return isProductionEnvironment() || process.env.ADAPT_FEEDS_OUTSIDE_PRODUCTION === "true";
}

/**
 * Query filter for records ADAPT may see. Production serves production data
 * only; a non-production instance that was deliberately reopened serves its
 * synthetic data, which is the point of reopening it.
 */
export function adaptDataFilter(): { dataClass?: "production" } {
  return isProductionEnvironment() ? { dataClass: "production" } : {};
}

let warned = false;

/**
 * Route guard for ADAPT-facing endpoints. A 404, not a 403, so a misrouted
 * caller learns nothing about what would be here.
 */
export function requireAdaptIntegration(_req: Request, res: Response, next: NextFunction) {
  if (!adaptIntegrationAllowed()) {
    return res.status(404).json({ err: true, errMsg: "Not found" });
  }
  if (!isProductionEnvironment() && !warned) {
    warned = true;
    log.warn(
      { appEnv: process.env.APP_ENV },
      "ADAPT-facing endpoints are open outside production (ADAPT_FEEDS_OUTSIDE_PRODUCTION=true). They serve synthetic data; never point ADAPT at this instance."
    );
  }
  return next();
}

/** For outbound jobs: throws unless this instance may contact ADAPT. */
export function assertAdaptIntegrationAllowed(what: string): void {
  if (!isProductionEnvironment()) {
    // Outbound is stricter than inbound: no override. Reading synthetic data
    // is a test; writing to ADAPT from staging would touch real courses.
    throw new Error(`${what}: ADAPT is only contacted from production (APP_ENV is "${process.env.APP_ENV}")`);
  }
}
