import { Response } from "express";
import { FilterQuery } from "mongoose";
import { z } from "zod";
import logger, { childLogger } from "../logger.js";
import Activity, { ActivityInterface } from "../models/activity.js";
import User from "../models/user.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";
import {
  getActivitiesByAuthorSchema,
  getActivityByH5PIDSchema,
  getActivitySchema,
  getAdaptFeedSchema,
  getCommonsActivitiesSchema,
  getMyActivitiesSchema,
} from "./validators/activities.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import { adaptDataFilter } from "../util/adapt-integration.js";

const adaptLog = childLogger("adapt-feed");

/**
 * Fields returned for a catalog row. Deliberately narrower than the stored
 * document so a collaborator list never rides along with a public listing.
 */
const ACTIVITY_LIST_PROJECTION = {
  _id: 0,
  __v: 0,
  collaborators: 0,
  legacyNodeID: 0,
};

/**
 * Escapes user input for use inside a `$regex`, so a search for "C++" or "("
 * matches literally instead of failing or backtracking.
 */
function _escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Restricts a query to activities the caller is allowed to see.
 *
 * Public activities are visible to everyone. A signed-in user additionally sees
 * their own private activities and any private activity they collaborate on.
 */
function _buildVisibilityFilter(
  userUUID?: string
): FilterQuery<ActivityInterface> {
  if (!userUUID) return { visibility: "public" };
  return {
    $or: [
      { visibility: "public" },
      { createdBy: userUUID },
      { collaborators: userUUID },
    ],
  };
}

/**
 * Returns activities listed in the public catalog for this instance's
 * organization. Safe to call anonymously.
 */
async function getCommonsActivities(
  req: ZodReqWithOptionalUser<z.infer<typeof getCommonsActivitiesSchema>>,
  res: Response
) {
  try {
    const { query, library, subject, license, sort, sortDirection } = req.query;
    const page = parseInt(req.query.page.toString()) || 1;
    const limit = parseInt(req.query.limit.toString()) || 12;

    const matchConds: FilterQuery<ActivityInterface>[] = [
      { orgID: process.env.ORG_ID },
      { includeInLibrary: true },
      _buildVisibilityFilter(req.user?.decoded?.uuid),
    ];

    if (library) matchConds.push({ library });
    if (subject) matchConds.push({ subjects: subject });
    if (license) matchConds.push({ "license.name": license });
    if (query) {
      const pattern = _escapeRegex(query);
      matchConds.push({
        $or: [
          { title: { $regex: pattern, $options: "i" } },
          { description: { $regex: pattern, $options: "i" } },
          { tags: { $regex: pattern, $options: "i" } },
        ],
      });
    }

    const sortField =
      sort === "title"
        ? "title"
        : sort === "created"
        ? "createdAt"
        : "updatedAt";
    const sortOrder = sortDirection === "ascending" ? 1 : -1;

    const offset = getPaginationOffset(page, limit);

    const [activities, total] = await Promise.all([
      Activity.find({ $and: matchConds }, ACTIVITY_LIST_PROJECTION)
        .sort({ [sortField]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      Activity.countDocuments({ $and: matchConds }),
    ]);

    return res.send({
      err: false,
      activities,
      cursor: total > offset + limit ? offset + limit : undefined,
      total_items: total,
    });
  } catch (err) {
    logger.error({ err }, "getCommonsActivities failed");
    return conductor500Err(res);
  }
}

/**
 * Fields the public activity page reads. Collaborators, migration bookkeeping
 * and the ADAPT id stay server-side: the page is public and Studio's own
 * public page did not show them either.
 */
const ACTIVITY_PAGE_PROJECTION = {
  _id: 0,
  activityID: 1,
  h5pContentID: 1,
  title: 1,
  description: 1,
  library: 1,
  libraryTitle: 1,
  language: 1,
  h5pAuthors: 1,
  source: 1,
  publisher: 1,
  subjects: 1,
  tags: 1,
  visibility: 1,
  includeInLibrary: 1,
  license: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
};

/**
 * Names credited in the H5P package metadata. Studio stored the H5P `authors`
 * array as JSON text, so a malformed value yields no names rather than an error.
 */
function _parseH5PAuthorNames(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a) => (typeof a?.name === "string" ? a.name.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Returns a single activity by its Conductor identifier, shaped for the public
 * activity page.
 *
 * `authors` is the credit to display: the H5P metadata authors when the
 * package names any, otherwise the owning Conductor user. A private activity
 * the caller cannot see is a plain 404, the same as a missing one, so the page
 * never reveals that it exists.
 */
async function getActivity(
  req: ZodReqWithOptionalUser<z.infer<typeof getActivitySchema>>,
  res: Response
) {
  try {
    const activity = await Activity.findOne(
      {
        activityID: req.params.activityID,
        orgID: process.env.ORG_ID,
        ...(_buildVisibilityFilter(req.user?.decoded?.uuid)),
      },
      ACTIVITY_PAGE_PROJECTION
    ).lean();

    if (!activity) return conductor404Err(res);

    let authors = _parseH5PAuthorNames(activity.h5pAuthors);
    if (!authors.length && activity.createdBy) {
      const owner = await User.findOne(
        { uuid: activity.createdBy },
        { _id: 0, firstName: 1, lastName: 1 }
      ).lean();
      const name = [owner?.firstName, owner?.lastName].filter(Boolean).join(" ");
      if (name) authors = [name];
    }

    const { h5pAuthors: _h5pAuthors, createdBy: _createdBy, ...rest } = activity;
    return res.send({ err: false, activity: { ...rest, authors } });
  } catch (err) {
    logger.error({ err }, "getActivity failed");
    return conductor500Err(res);
  }
}

/**
 * Resolves an activity from the H5P content id.
 *
 * This is what lets a legacy Studio URL (`/h5p/{id}`) redirect to its Conductor
 * page without a lookup table.
 */
async function getActivityByH5PID(
  req: ZodReqWithOptionalUser<z.infer<typeof getActivityByH5PIDSchema>>,
  res: Response
) {
  try {
    const activity = await Activity.findOne(
      {
        // Number() so only a scalar reaches the query, whatever the validator lets through.
        h5pContentID: Number(req.params.h5pContentID),
        orgID: process.env.ORG_ID,
        ...(_buildVisibilityFilter(req.user?.decoded?.uuid)),
      },
      { _id: 0, __v: 0 }
    ).lean();

    if (!activity) return conductor404Err(res);

    return res.send({ err: false, activity });
  } catch (err) {
    logger.error({ err }, "getActivityByH5PID failed");
    return conductor500Err(res);
  }
}

/**
 * Returns the public activities an author has chosen to show on their profile.
 */
async function getActivitiesByAuthor(
  req: ZodReqWithOptionalUser<z.infer<typeof getActivitiesByAuthorSchema>>,
  res: Response
) {
  try {
    const page = parseInt(req.query.page.toString()) || 1;
    const limit = parseInt(req.query.limit.toString()) || 12;
    const offset = getPaginationOffset(page, limit);

    const matchConds: FilterQuery<ActivityInterface> = {
      orgID: process.env.ORG_ID,
      createdBy: req.params.uuid,
      includeInProfile: true,
      visibility: "public",
    };

    const [activities, total] = await Promise.all([
      Activity.find(matchConds, ACTIVITY_LIST_PROJECTION)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Activity.countDocuments(matchConds),
    ]);

    return res.send({
      err: false,
      activities,
      cursor: total > offset + limit ? offset + limit : undefined,
      total_items: total,
    });
  } catch (err) {
    logger.error({ err }, "getActivitiesByAuthor failed");
    return conductor500Err(res);
  }
}

/**
 * The UI's three visibility levels, derived from the stored fields. An
 * activity with no `includeInLibrary` value counts as listed, matching the
 * schema default and Studio's.
 */
const VISIBILITY_LEVEL_EXPR = {
  $cond: [
    { $eq: ["$visibility", "private"] },
    "private",
    { $cond: [{ $eq: ["$includeInLibrary", false] }, "unlisted", "public"] },
  ],
};

const VISIBILITY_LEVEL_FILTERS: Record<string, FilterQuery<ActivityInterface>> = {
  public: { visibility: "public", includeInLibrary: { $ne: false } },
  unlisted: { visibility: "public", includeInLibrary: false },
  private: { visibility: "private" },
};

const MY_ACTIVITIES_SORTS: Record<string, Record<string, 1 | -1>> = {
  updated: { updatedAt: -1, _id: 1 },
  created: { createdAt: -1, _id: 1 },
  title: { title: 1, _id: 1 },
};

/**
 * The signed-in user's activities for My H5P: those they own and those they
 * collaborate on, each marked with the caller's role.
 *
 * One aggregation returns the page of results plus the counts the visibility
 * filter shows. `counts` respects the search but not the visibility filter,
 * so each option shows how many results choosing it would give.
 * `overallTotal` ignores both, for the "search all N" message.
 */
async function getMyActivities(
  req: ZodReqWithUser<z.infer<typeof getMyActivitiesSchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const { query, visibility, sort } = req.query;
    const page = parseInt(req.query.page.toString()) || 1;
    const limit = parseInt(req.query.limit.toString()) || 24;
    const offset = getPaginationOffset(page, limit);

    const searchMatch: FilterQuery<ActivityInterface> = {};
    if (query) {
      const pattern = _escapeRegex(query);
      searchMatch.$or = [
        { title: { $regex: pattern, $options: "i" } },
        { tags: { $regex: pattern, $options: "i" } },
        { libraryTitle: { $regex: pattern, $options: "i" } },
      ];
    }
    const visibilityMatch =
      visibility === "all" ? {} : VISIBILITY_LEVEL_FILTERS[visibility];

    const [result] = await Activity.aggregate([
      {
        $match: {
          orgID: process.env.ORG_ID,
          $or: [{ createdBy: userUUID }, { collaborators: userUUID }],
        },
      },
      {
        $facet: {
          overall: [{ $count: "n" }],
          counts: [
            { $match: searchMatch },
            { $group: { _id: VISIBILITY_LEVEL_EXPR, n: { $sum: 1 } } },
          ],
          items: [
            { $match: searchMatch },
            { $match: visibilityMatch },
            { $sort: MY_ACTIVITIES_SORTS[sort] },
            { $skip: offset },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                activityID: 1,
                title: 1,
                library: 1,
                libraryTitle: 1,
                createdAt: 1,
                updatedAt: 1,
                visibility: VISIBILITY_LEVEL_EXPR,
                role: {
                  $cond: [{ $eq: ["$createdBy", userUUID] }, "owner", "collaborator"],
                },
              },
            },
          ],
        },
      },
    ]).collation({ locale: "en", strength: 2 });

    const counts = { all: 0, public: 0, unlisted: 0, private: 0 };
    for (const c of result.counts as { _id: keyof typeof counts; n: number }[]) {
      counts[c._id] = c.n;
      counts.all += c.n;
    }
    const totalItems = visibility === "all" ? counts.all : counts[visibility];

    return res.send({
      err: false,
      activities: result.items,
      counts,
      overallTotal: result.overall[0]?.n ?? 0,
      total_items: totalItems,
      cursor: totalItems > offset + limit ? offset + limit : undefined,
    });
  } catch (err) {
    logger.error({ err }, "getMyActivities failed");
    return conductor500Err(res);
  }
}

/**
 * Escapes one CSV field per RFC 4180.
 */
function _csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * The ADAPT reconciliation feed, replacing Studio's `/api/v2/nodes`.
 *
 * ADAPT pulls this as an unpaginated CSV to map its question bank onto H5P
 * activities. Column names and order match Studio's output exactly, and every
 * activity is included regardless of visibility, because Studio's view applied
 * no publication filter and ADAPT relies on seeing the full set.
 *
 * ADAPT has since confirmed it does not call this endpoint and has no knowledge
 * of it, so this is no longer a contract with an external consumer. It is kept
 * because Studio served it, the shape is cheap to reproduce, and Studio's
 * `api_user` role and `api_for_adapt` view suggest something once relied on it.
 * Check the access logs before assuming nothing does.
 *
 * One deliberate difference from Studio's output: the `uid` column carried
 * Drupal's integer user id, which has no Conductor equivalent. It emits the
 * author's LibreOne UUID (`User.centralID`) instead, the one author identifier
 * meaningful in Studio, Conductor and ADAPT alike. With no consumer, that
 * difference no longer needs anyone's sign-off.
 */
async function getAdaptFeed(
  req: z.infer<typeof getAdaptFeedSchema>,
  res: Response
) {
  try {
    const activities = await Activity.find(
      { orgID: process.env.ORG_ID, ...adaptDataFilter() },
      { _id: 0, h5pContentID: 1, adaptID: 1, authorCentralID: 1 }
    )
      .sort({ h5pContentID: 1 })
      .lean();

    // `uid` is read straight off the activity. Joining through a local `User`
    // on `createdBy` would blank the column for the 87 authors who hold a valid
    // LibreOne identity but have no Conductor account yet.
    const centralIDs = [
      ...new Set(activities.map((a) => a.authorCentralID).filter(Boolean)),
    ] as string[];

    // Email is the only column that still needs the local record.
    const authors = await User.find(
      { centralID: { $in: centralIDs } },
      { _id: 0, centralID: 1, email: 1 }
    ).lean();
    const emailByCentralID = new Map(authors.map((u) => [u.centralID, u.email]));

    const rows = activities.map((a) => ({
      h5p_id: a.h5pContentID,
      adapt_id: a.adaptID ?? "",
      uid: a.authorCentralID ?? "",
      email: a.authorCentralID
        ? emailByCentralID.get(a.authorCentralID) ?? ""
        : "",
    }));

    adaptLog.info({ rows: rows.length }, "Served ADAPT reconciliation feed");

    if (req.query.format === "json") {
      return res.send({ err: false, nodes: rows });
    }

    const header = "h5p_id,adapt_id,uid,email";
    const body = rows
      .map((r) =>
        [r.h5p_id, r.adapt_id, r.uid, r.email].map(_csvField).join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="nodes.csv"');
    return res.send(rows.length ? header + "\n" + body + "\n" : header + "\n");
  } catch (err) {
    logger.error({ err }, "getAdaptFeed failed");
    return conductor500Err(res);
  }
}

export default {
  getCommonsActivities,
  getActivity,
  getActivityByH5PID,
  getActivitiesByAuthor,
  getMyActivities,
  getAdaptFeed,
};
