import Activity from "../../models/activity.js";
import { childLogger } from "../../logger.js";
import { assertAdaptIntegrationAllowed } from "../../util/adapt-integration.js";

const log = childLogger("adapt-id-sync");

/**
 * Fills in `Activity.adaptID` from ADAPT, replacing the Studio cron job that
 * did the same (`adapt_cron` in Studio's `adapt` module).
 *
 * ADAPT's `PATCH /api/h5p-collections/get-adapt-question-id-by-h5p-id/{id}`
 * is a lookup, not a write: it finds ADAPT questions with technology `h5p`
 * and that content id. One match is the answer. Several are disambiguated by
 * the question editor's email, which must equal the `email` in the body.
 * Studio always sent one fixed staff address, so this does the same with
 * `ADAPT_ID_SYNC_EMAIL`. ADAPT answers 200 with `type: "error"` for no
 * match, an ambiguous match, or a wrong token.
 *
 * The Bearer token is ADAPT's `H5P_API_PASSWORD`, which Conductor already
 * holds as `STUDIO_COMPAT_BASIC_PASSWORD` for `/studio/author`.
 *
 * Studio took the 50 most recently changed nodes without an id on every run,
 * so a few activities ADAPT never imported held the queue forever. This
 * records each attempt in `adaptIDCheckedAt` and takes the least recently
 * checked first, so every activity gets its turn.
 */

const LOOKUP_URL = "https://adapt.libretexts.org/api/h5p-collections/get-adapt-question-id-by-h5p-id";
const REQUEST_TIMEOUT_MS = 10_000;
export const ADAPT_ID_SYNC_DEFAULT_LIMIT = 100;

export class AdaptIdSyncNotConfiguredError extends Error {}

export interface AdaptIdSyncResult {
  checked: number;
  found: number;
  failed: number;
}

async function lookUpAdaptID(h5pContentID: number, token: string, email: string): Promise<string | null> {
  const res = await fetch(`${LOOKUP_URL}/${h5pContentID}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ADAPT answered ${res.status}`);
  const body: any = await res.json();
  if (body?.type === "success" && body.adapt_question_id) return String(body.adapt_question_id);
  if (body?.message === "Invalid bearer token.") throw new AdaptIdSyncNotConfiguredError("ADAPT refused the bearer token");
  return null;
}

/**
 * Looks up ADAPT ids for up to `limit` production activities that lack one.
 * Throws outside production, before contacting ADAPT.
 */
export async function syncAdaptIDs(limit = ADAPT_ID_SYNC_DEFAULT_LIMIT): Promise<AdaptIdSyncResult> {
  assertAdaptIntegrationAllowed("ADAPT id sync");
  const token = process.env.STUDIO_COMPAT_BASIC_PASSWORD;
  const email = process.env.ADAPT_ID_SYNC_EMAIL;
  if (!token || !email) {
    throw new AdaptIdSyncNotConfiguredError("STUDIO_COMPAT_BASIC_PASSWORD or ADAPT_ID_SYNC_EMAIL is not set");
  }

  const batch = await Activity.find(
    {
      orgID: process.env.ORG_ID,
      dataClass: "production",
      adaptID: { $in: [null, ""] },
      pendingFirstSave: { $ne: true },
    },
    { _id: 0, activityID: 1, h5pContentID: 1 }
  )
    .sort({ adaptIDCheckedAt: 1, updatedAt: -1 })
    .limit(limit)
    .lean();

  const result: AdaptIdSyncResult = { checked: 0, found: 0, failed: 0 };
  for (const activity of batch) {
    let adaptID: string | null = null;
    try {
      adaptID = await lookUpAdaptID(activity.h5pContentID, token, email);
    } catch (err) {
      if (err instanceof AdaptIdSyncNotConfiguredError) throw err;
      result.failed += 1;
      log.warn({ err, h5pContentID: activity.h5pContentID }, "ADAPT id lookup failed; will retry on a later run");
      continue;
    }
    // A found id moves `updatedAt`, as Studio's node save moved `changed`,
    // so ADAPT's `/api/h5p/all?changed=` poll picks it up. A miss doesn't.
    await Activity.updateOne(
      { activityID: activity.activityID },
      { $set: { adaptIDCheckedAt: new Date(), ...(adaptID ? { adaptID } : {}) } },
      { timestamps: Boolean(adaptID) }
    );
    result.checked += 1;
    if (adaptID) {
      result.found += 1;
      log.info({ h5pContentID: activity.h5pContentID, adaptID }, "Recorded ADAPT id");
    }
  }
  log.info({ ...result, batch: batch.length }, "ADAPT id sync finished");
  return result;
}
