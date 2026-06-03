import { debugError } from "../../debug.js";
import CoverPageIdCache from "../../models/coverpageidcache.js";
import { getPageID } from "../../util/librariesclient.js";
import {
  extractCoverPagePath,
  CoverPageLocation,
} from "../../util/coverPagePath.js";

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface ResolvedCoverPageId extends CoverPageLocation {
  id: string;
  bookID: string;
}

export async function resolveCoverPageIdFromUrl(
  rawUrl: string
): Promise<ResolvedCoverPageId | null> {
  const location = extractCoverPagePath(rawUrl);
  if (!location) return null;
  return resolveCoverPageIdFromPath(location);
}

export async function resolveCoverPageIdFromPath(
  location: CoverPageLocation
): Promise<ResolvedCoverPageId | null> {
  const { subdomain, coverPath } = location;
  const cacheKey = `${subdomain}:${coverPath}`;

  try {
    const hit = await CoverPageIdCache.findOne({ cacheKey });
    if (hit && hit.expiresAt > new Date()) {
      const bookID = `${subdomain}-${hit.pageId}`;
      return { id: hit.pageId, subdomain, coverPath, bookID };
    }
  } catch (err) {
    debugError(err);
  }

  const id = await getPageID(coverPath, subdomain);
  if (!id) return null;

  try {
    await CoverPageIdCache.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          subdomain,
          coverPath,
          pageId: id,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    debugError(err);
  }

  const bookID = `${subdomain}-${id}`;
  return { id, subdomain, coverPath, bookID };
}
