import { Request, Response } from "express";
import { z } from "zod";
import { childLogger } from "../logger.js";
import Activity from "../models/activity.js";
import ActivityCollection from "../models/activityCollection.js";
import StudioLegacyNode, {
  normalizeStudioAlias,
} from "../models/studioLegacyNode.js";
import { resolveStudioLegacyPathSchema } from "./validators/studio-legacy.js";

const log = childLogger("studio-legacy");

/**
 * Where resolved links land.
 *
 * The collection page is not designed yet, so collection links go to the
 * Interactives listing for now. When `/interactives-collections/:collectionID`
 * exists, set `COLLECTION_PAGE_LIVE` to true. Unresolved links also go to
 * `/interactives`, the same page Cloudflare's catch-all sends every other
 * Studio URL to.
 */
const COLLECTION_PAGE_LIVE = false;

export const STUDIO_LEGACY_TARGETS = {
  activity: (activityID: string) => `/interactive/${activityID}`,
  collection: (collectionID: string) =>
    COLLECTION_PAGE_LIVE ? `/interactives-collections/${collectionID}` : "/interactives",
  fallback: "/interactives",
};

/**
 * 302 until the Commons pages above exist and their paths are final. Browsers
 * cache a 301 indefinitely, so a permanent redirect to a path that later
 * changes could never be corrected for anyone who had followed it.
 */
const REDIRECT_STATUS = 302;

const NUMERIC = /^\d+$/;

/**
 * Resolves an old `studio.libretexts.org` page URL to its Conductor page.
 *
 * Cloudflare Single Redirects send `/h5p/{alias}`, `/node/{nid}` and
 * `/collection/{alias}` here as `/commons/studio-legacy/{kind}/{value}`. The
 * alias table goes first because the number in a `/h5p/` URL is not reliably
 * a content id (see `models/studioLegacyNode.ts`). Without a match, the URL
 * is read the way Studio's current pathauto patterns built it.
 *
 * Always a redirect, never an error page: a dead Studio link lands on
 * `/interactives`. Visibility is left to the destination page, which already enforces
 * it, so a private activity's link reaches its page and that page decides.
 */
async function resolveStudioLegacyPath(
  req: Request & z.infer<typeof resolveStudioLegacyPathSchema>,
  res: Response
) {
  const { kind, value } = req.params;
  const legacyPath = normalizeStudioAlias(`/${kind}/${value}`);
  const orgID = process.env.ORG_ID;

  try {
    const node =
      kind === "node" && NUMERIC.test(value)
        ? await StudioLegacyNode.findOne({ nid: Number(value), orgID }).lean()
        : await StudioLegacyNode.findOne({ aliases: legacyPath, orgID }).lean();

    let h5pContentID: number | undefined;
    let collectionNid: number | undefined;
    if (node?.kind === "activity") h5pContentID = node.h5pContentID;
    else if (node?.kind === "collection") collectionNid = node.nid;
    else if (!node && kind === "h5p" && NUMERIC.test(value)) h5pContentID = Number(value);
    else if (!node && kind === "collection" && NUMERIC.test(value)) collectionNid = Number(value);

    let target: string | undefined;
    if (h5pContentID) {
      const activity = await Activity.findOne(
        { h5pContentID, orgID },
        { _id: 0, activityID: 1 }
      ).lean();
      if (activity) target = STUDIO_LEGACY_TARGETS.activity(activity.activityID);
    } else if (collectionNid) {
      const collection = await ActivityCollection.findOne(
        { legacyCollectionID: collectionNid, orgID },
        { _id: 0, collectionID: 1 }
      ).lean();
      if (collection) target = STUDIO_LEGACY_TARGETS.collection(collection.collectionID);
    }

    if (!target) {
      log.info(
        { legacyPath, matchedNid: node?.nid, h5pContentID, collectionNid },
        "Studio legacy path did not resolve"
      );
      return res.redirect(REDIRECT_STATUS, STUDIO_LEGACY_TARGETS.fallback);
    }
    log.debug({ legacyPath, target }, "Resolved Studio legacy path");
    return res.redirect(REDIRECT_STATUS, target);
  } catch (err) {
    log.error({ err, legacyPath }, "Studio legacy path resolution failed");
    return res.redirect(REDIRECT_STATUS, STUDIO_LEGACY_TARGETS.fallback);
  }
}

export default {
  resolveStudioLegacyPath,
};
