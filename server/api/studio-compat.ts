import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { childLogger } from "../logger.js";
import Activity, { ActivityInterface } from "../models/activity.js";
import ActivityCollection from "../models/activityCollection.js";
import User from "../models/user.js";
import CentralIdentityService from "./services/central-identity-service.js";
import {
  STUDIO_ORIGIN,
  drupalBasicString,
  drupalEscape,
  drupalHtmlDatetimeSite,
  drupalLabels,
  drupalMediumSite,
  drupalShortUTC,
  studioDateFilterStart,
} from "../util/studio-format.js";
import { adaptDataFilter } from "../util/adapt-integration.js";

const log = childLogger("studio-compat");

/**
 * Replacements for the five Studio API paths ADAPT calls. The Cloudflare
 * Worker on studio.libretexts.org forwards each path here once it passes its
 * diff against the responses captured from production (migration runbook,
 * Phase 6 step 8). Until then the Worker sends them to frozen Studio.
 *
 *   /api/h5p/all?changed=YYYY-MM-DD   -> GET /api/v1/studio/h5p/all
 *   /api/h5p/{id}                     -> GET /api/v1/studio/h5p/{id}
 *   /api/author/{email}               -> GET /api/v1/studio/author/{email}
 *   /api/collections/list             -> GET /api/v1/studio/collections/list
 *   /api/collections/{cid}            -> GET /api/v1/studio/collections/{cid}
 *
 * Every response is a bare JSON array, every value a string, missing values
 * `""`, exactly as Studio's REST views produced them. ADAPT calls these with
 * curl and no timeout, and treats anything it cannot decode as "no data", so
 * shape matters more than elegance here. See `util/studio-format.ts` for the
 * escaping and date formats.
 *
 * What cannot be reproduced, and does not matter to ADAPT:
 * - `view_user` was Drupal's user page; there is no Drupal user id, so `""`.
 * - Collection `thumbnail`s were Studio-hosted screenshots, not migrated, so
 *   `""`.
 * - Studio's collection list repeated a collection once per subject/tag
 *   combination; here each appears once. ADAPT de-duplicates by `cid`.
 */

/** `api_h5p`'s REST display ran a 100-item pager, and ADAPT never pages. */
const H5P_FEED_LIMIT = 100;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- owners

type Owner = { name: string; email: string };
type OwnerRef = Pick<ActivityInterface, "createdBy" | "authorCentralID">;

const libreOne = new CentralIdentityService();
const libreOneCache = new Map<string, { owner: Owner | null; at: number }>();
const LIBREONE_TTL_MS = 60 * 60 * 1000;
const LIBREONE_CACHE_MAX = 5000;

async function libreOneOwner(centralID: string): Promise<Owner | null> {
  const cached = libreOneCache.get(centralID);
  if (cached && Date.now() - cached.at < LIBREONE_TTL_MS) return cached.owner;
  let owner: Owner | null = null;
  try {
    const user = (await libreOne.getUser(centralID)).data?.data;
    if (user) {
      owner = {
        name: [user.first_name, user.last_name].filter(Boolean).join(" "),
        email: user.email ?? "",
      };
    }
  } catch (err) {
    log.debug({ err, centralID }, "LibreOne owner lookup failed");
  }
  if (libreOneCache.size >= LIBREONE_CACHE_MAX) libreOneCache.clear();
  libreOneCache.set(centralID, { owner, at: Date.now() });
  return owner;
}

/**
 * Display name and email for each activity or collection owner, which Studio
 * rendered from its user records. A local Conductor user first; for the
 * authors with a LibreOne identity but no Conductor account, LibreOne.
 */
async function resolveOwners(refs: OwnerRef[]): Promise<(ref: OwnerRef) => Owner> {
  const uuids = [...new Set(refs.map((r) => r.createdBy).filter(Boolean))] as string[];
  const centralIDs = [...new Set(refs.map((r) => r.authorCentralID).filter(Boolean))] as string[];
  const users = await User.find(
    { $or: [{ uuid: { $in: uuids } }, { centralID: { $in: centralIDs } }] },
    { _id: 0, uuid: 1, centralID: 1, firstName: 1, lastName: 1, email: 1 }
  ).lean();
  const byUUID = new Map<string, Owner>();
  const byCentral = new Map<string, Owner>();
  for (const u of users) {
    const owner = { name: [u.firstName, u.lastName].filter(Boolean).join(" "), email: u.email ?? "" };
    if (u.uuid) byUUID.set(u.uuid, owner);
    if (u.centralID) byCentral.set(u.centralID, owner);
  }
  if (libreOne.isConfigured()) {
    const missing = centralIDs.filter((id) => !byCentral.has(id));
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(
        missing.slice(i, i + 5).map(async (id) => {
          const owner = await libreOneOwner(id);
          if (owner) byCentral.set(id, owner);
        })
      );
    }
  }
  const none: Owner = { name: "", email: "" };
  return (ref) =>
    (ref.createdBy && byUUID.get(ref.createdBy)) ||
    (ref.authorCentralID && byCentral.get(ref.authorCentralID)) ||
    none;
}

// ---------------------------------------------------------------- h5p

const H5P_ROW_PROJECTION = {
  _id: 0, h5pContentID: 1, title: 1, libraryTitle: 1, legacyLibraryID: 1, h5pAuthors: 1, license: 1,
  source: 1, description: 1, createdAt: 1, updatedAt: 1, subjects: 1, tags: 1, legacyNodeUUID: 1,
  legacyNodeID: 1, language: 1, createdBy: 1, authorCentralID: 1,
};

type ActivityRow = Pick<
  ActivityInterface,
  | "h5pContentID" | "title" | "libraryTitle" | "legacyLibraryID" | "h5pAuthors" | "license" | "source"
  | "description" | "subjects" | "tags" | "legacyNodeUUID" | "legacyNodeID" | "language" | "createdBy"
  | "authorCentralID"
> & { createdAt?: Date; updatedAt?: Date };

/** One row of Studio's `api/h5p` view, keys in Studio's order. */
function h5pRow(a: ActivityRow, owner: Owner) {
  const id = String(a.h5pContentID);
  return {
    id,
    title_1: drupalEscape(a.title),
    title: drupalEscape(a.title),
    type: drupalEscape(a.libraryTitle),
    type_id: a.legacyLibraryID !== undefined && a.legacyLibraryID !== null ? String(a.legacyLibraryID) : "",
    uid: drupalEscape(owner.name),
    authors: drupalBasicString(a.h5pAuthors),
    license: drupalEscape(a.license?.name),
    license_extras: drupalBasicString(a.license?.additionalTerms),
    license_version: drupalEscape(a.license?.version),
    h5p_source: drupalEscape(a.source),
    body: a.description ?? "",
    created: drupalShortUTC(a.createdAt),
    changed: drupalShortUTC(a.updatedAt),
    field_subject: drupalLabels(a.subjects),
    field_tags: drupalLabels(a.tags),
    uuid: a.legacyNodeUUID ?? "",
    adapt_id: `h5p-${id}`,
    view_node: `${STUDIO_ORIGIN}/h5p/${id}`,
    mail: drupalBasicString(owner.email),
    view_user: "",
    default_language: drupalEscape(a.language),
  };
}

/** Published in Studio's sense, with content saved, and fit for ADAPT to see. */
const published = () => ({ visibility: "public", pendingFirstSave: { $ne: true }, ...adaptDataFilter() });

/**
 * `GET /studio/h5p/all?changed=YYYY-MM-DD` and `GET /studio/h5p/{id}`.
 *
 * Studio's `api/h5p/%` view: published activities, unlisted ones included,
 * newest change first, 100 at most. `changed` is a lower bound measured from
 * midnight US Eastern, which is how Drupal parsed it; ADAPT sends today's date,
 * so it sees the newest 100 changes since midnight. `updatedAt` is Studio's
 * `changed`: imported from it, and moved by every edit since.
 */
async function getStudioH5P(req: Request, res: Response) {
  try {
    const { idOrAll } = req.params;
    const filter: Record<string, unknown> = { orgID: process.env.ORG_ID, ...published() };
    if (idOrAll !== "all") {
      if (!/^\d+$/.test(idOrAll)) return res.json([]);
      filter.h5pContentID = Number(idOrAll);
    }
    const changed = typeof req.query.changed === "string" ? req.query.changed : "";
    if (DAY.test(changed)) filter.updatedAt = { $gte: studioDateFilterStart(changed) };

    const activities = (await Activity.find(filter, H5P_ROW_PROJECTION)
      .sort({ updatedAt: -1, h5pContentID: -1 })
      .limit(H5P_FEED_LIMIT)
      .lean()) as ActivityRow[];
    const ownerOf = await resolveOwners(activities);
    return res.json(activities.map((a) => h5pRow(a, ownerOf(a))));
  } catch (err) {
    log.error({ err }, "getStudioH5P failed");
    return res.status(500).json([]);
  }
}

// ---------------------------------------------------------------- author

const basicUser = () => process.env.STUDIO_COMPAT_BASIC_USER;
const basicPassword = () => process.env.STUDIO_COMPAT_BASIC_PASSWORD;

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * HTTP Basic auth for `/studio/author`, as Studio's view required. ADAPT
 * sends `H5P_API_USERNAME` and `H5P_API_PASSWORD`; Conductor holds the same
 * pair as `STUDIO_COMPAT_BASIC_USER` and `STUDIO_COMPAT_BASIC_PASSWORD`.
 * Unset, the endpoint refuses everyone rather than serving unauthenticated.
 */
function requireStudioBasicAuth(req: Request, res: Response, next: NextFunction) {
  const user = basicUser();
  const password = basicPassword();
  if (!user || !password) {
    log.error("STUDIO_COMPAT_BASIC_USER or STUDIO_COMPAT_BASIC_PASSWORD is not set");
    return res.status(503).json([]);
  }
  const header = req.headers.authorization ?? "";
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header);
  if (match) {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep > -1 && sameSecret(decoded.slice(0, sep), user) && sameSecret(decoded.slice(sep + 1), password)) {
      return next();
    }
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="Studio API"');
  return res.status(401).json([]);
}

/**
 * `GET /studio/author/{email}`: Studio's `api/author/%` view. Published
 * activities the user with that email owns, newest change first, as
 * `[{ "h5p_id": "123" }]`. Activities they collaborate on are not included.
 * ADAPT calls it on every question editor load.
 */
async function getStudioAuthorH5P(req: Request, res: Response) {
  try {
    const email = String(req.params.email ?? "").trim().toLowerCase();
    if (!email || email.length > 254 || !email.includes("@")) return res.json([]);

    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find(
      { email: { $regex: `^${escaped}$`, $options: "i" } },
      { _id: 0, uuid: 1, centralID: 1 }
    ).lean();
    const uuids = users.map((u) => u.uuid).filter(Boolean);
    const centralIDs = new Set(users.map((u) => u.centralID).filter(Boolean) as string[]);

    // Authors with a LibreOne identity but no Conductor account own
    // activities through `authorCentralID` only.
    if (!users.length && libreOne.isConfigured()) {
      try {
        const found = (await libreOne.getUsers({ query: email, limit: 10 })).data?.data ?? [];
        for (const u of found as any[]) {
          if (typeof u?.email === "string" && u.email.toLowerCase() === email && u.uuid) centralIDs.add(u.uuid);
        }
      } catch (err) {
        log.warn({ err }, "LibreOne email lookup failed");
      }
    }
    if (!uuids.length && !centralIDs.size) return res.json([]);

    const activities = await Activity.find(
      {
        orgID: process.env.ORG_ID,
        ...published(),
        $or: [{ createdBy: { $in: uuids } }, { authorCentralID: { $in: [...centralIDs] } }],
      },
      { _id: 0, h5pContentID: 1 }
    )
      .sort({ updatedAt: -1, h5pContentID: -1 })
      .lean();
    return res.json(activities.map((a) => ({ h5p_id: String(a.h5pContentID) })));
  } catch (err) {
    log.error({ err }, "getStudioAuthorH5P failed");
    return res.status(500).json([]);
  }
}

// ---------------------------------------------------------------- collections

/**
 * `GET /studio/collections/list`: Studio's `api/collections/list`. Collections
 * that are published and included in the library, most recently changed
 * first. `count` is how many activities the collection references.
 */
async function getStudioCollectionsList(_req: Request, res: Response) {
  try {
    const collections = await ActivityCollection.find(
      {
        orgID: process.env.ORG_ID,
        visibility: "public",
        includeInLibrary: { $ne: false },
        legacyCollectionID: { $exists: true },
        ...adaptDataFilter(),
      },
      {
        _id: 0, legacyCollectionID: 1, title: 1, createdBy: 1, authorCentralID: 1, createdAt: 1, subjects: 1,
        tags: 1, description: 1, oerReference: 1, oerReferenceTitle: 1, thumbnail: 1, subCollections: 1,
        updatedAt: 1,
      }
    )
      .sort({ updatedAt: -1, legacyCollectionID: -1 })
      .lean();
    const ownerOf = await resolveOwners(collections);
    return res.json(
      collections.map((c: any) => {
        const cid = String(c.legacyCollectionID);
        const count = (c.subCollections ?? []).reduce((n: number, s: any) => n + (s.h5pContentIDs?.length ?? 0), 0);
        return {
          title: drupalEscape(c.title),
          url: `${STUDIO_ORIGIN}/collection/${cid}`,
          cid,
          author_name: drupalEscape(ownerOf(c).name),
          date_created: drupalHtmlDatetimeSite(c.createdAt),
          subject: drupalLabels(c.subjects),
          tags: drupalLabels(c.tags),
          description: drupalBasicString(c.description),
          oer_reference: c.oerReference
            ? `<a href="${drupalEscape(c.oerReference)}">${drupalEscape(c.oerReferenceTitle || c.oerReference)}</a>`
            : "",
          thumbnail: "",
          count: String(count),
        };
      })
    );
  } catch (err) {
    log.error({ err }, "getStudioCollectionsList failed");
    return res.status(500).json([]);
  }
}

/**
 * `GET /studio/collections/{cid}`: Studio's `api/collections/%`. One row per
 * activity reference, grouped by sub-collection in order, the activities in
 * their order within it. ADAPT turns each `subcollection_title` into an
 * assignment. A reference to an activity that is not in Conductor, which only
 * happens after a sampled staging import, is left out.
 */
async function getStudioCollection(req: Request, res: Response) {
  try {
    const { cid } = req.params;
    if (!/^\d+$/.test(cid)) return res.json([]);
    const collection = await ActivityCollection.findOne(
      { orgID: process.env.ORG_ID, legacyCollectionID: Number(cid), visibility: "public", ...adaptDataFilter() },
      { _id: 0, subCollections: 1 }
    ).lean();
    if (!collection) return res.json([]);

    const ids = [...new Set(collection.subCollections.flatMap((s) => s.h5pContentIDs))];
    const activities = (await Activity.find(
      { orgID: process.env.ORG_ID, h5pContentID: { $in: ids }, pendingFirstSave: { $ne: true }, ...adaptDataFilter() },
      H5P_ROW_PROJECTION
    ).lean()) as ActivityRow[];
    const byID = new Map(activities.map((a) => [a.h5pContentID, a]));
    const ownerOf = await resolveOwners(activities);

    const rows = [];
    for (const sub of collection.subCollections) {
      for (const contentID of sub.h5pContentIDs) {
        const a = byID.get(contentID);
        if (!a) continue;
        const id = String(contentID);
        rows.push({
          title: drupalEscape(a.title),
          h5p_id: id,
          uuid: a.legacyNodeUUID ?? "",
          node_id: a.legacyNodeID !== undefined && a.legacyNodeID !== null ? String(a.legacyNodeID) : "",
          adapt_id: `h5p-${id}`,
          h5p_authors: drupalBasicString(a.h5pAuthors),
          node_author: drupalEscape(ownerOf(a).name),
          license: drupalEscape(a.license?.name),
          type: drupalEscape(a.libraryTitle),
          type_id: a.legacyLibraryID !== undefined && a.legacyLibraryID !== null ? String(a.legacyLibraryID) : "",
          subcollection_title: drupalEscape(sub.title),
          created: drupalMediumSite(a.createdAt),
          changed: drupalMediumSite(a.updatedAt),
          subject: drupalLabels(a.subjects),
          tags: drupalLabels(a.tags),
          view_node: `${STUDIO_ORIGIN}/h5p/${id}`,
        });
      }
    }
    return res.json(rows);
  } catch (err) {
    log.error({ err }, "getStudioCollection failed");
    return res.status(500).json([]);
  }
}

export default {
  getStudioH5P,
  getStudioAuthorH5P,
  requireStudioBasicAuth,
  getStudioCollectionsList,
  getStudioCollection,
};
