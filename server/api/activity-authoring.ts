import { Request, Response } from "express";
import { z } from "zod";
import b62 from "base62-random";
import { childLogger } from "../logger.js";
import Activity, { ActivityInterface } from "../models/activity.js";
import ActivityCollection from "../models/activityCollection.js";
import User from "../models/user.js";
import {
  conductor404Err,
  conductor500Err,
  conductorErr,
} from "../util/errorutils.js";
import {
  AuthoringNotConfiguredError,
  EDITOR_TOKEN_TTL_SECONDS,
  allocateH5PContentId,
  deleteH5PContent,
  signCapabilityToken,
} from "./services/h5p-authoring-service.js";
import {
  activityIDOnlySchema,
  createActivitySchema,
  updateActivitySchema,
} from "./validators/activities.js";
import { ZodReqWithUser } from "../types";

const log = childLogger("activity-authoring");

/** How long an activity may sit with no saved content before cleanup. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

type VisibilityLevel = "public" | "unlisted" | "private";

/**
 * The UI's three visibility levels as stored fields. Unlisted is public but
 * left out of the catalog, which is exactly Studio's "include in library" off.
 */
function visibilityFields(level: VisibilityLevel): Pick<ActivityInterface, "visibility" | "includeInLibrary"> {
  if (level === "private") return { visibility: "private", includeInLibrary: true };
  return { visibility: "public", includeInLibrary: level === "public" };
}

function isOwner(activity: Pick<ActivityInterface, "createdBy">, userUUID: string): boolean {
  return Boolean(activity.createdBy) && activity.createdBy === userUUID;
}

function canEdit(activity: Pick<ActivityInterface, "createdBy" | "collaborators">, userUUID: string): boolean {
  return isOwner(activity, userUUID) || (activity.collaborators ?? []).includes(userUUID);
}

/**
 * Only verified instructors create activities. Editing an existing one, as
 * owner or collaborator, needs no verification.
 */
async function isVerifiedInstructor(userUUID: string): Promise<boolean> {
  const user = await User.findOne({ uuid: userUUID }, { _id: 0, verifiedInstructor: 1 }).lean();
  return user?.verifiedInstructor === true;
}

/** Answers for the two failures every authoring call can hit. */
function authoringFailure(res: Response, err: unknown, what: string) {
  if (err instanceof AuthoringNotConfiguredError) {
    log.error({ err }, `${what}: authoring is not configured`);
    return conductorErr(res, 503, "err93");
  }
  log.error({ err }, `${what} failed`);
  return conductor500Err(res);
}

/** Metadata fields from a create or update body, in stored form. */
function metadataUpdate(body: z.infer<typeof createActivitySchema>["body"]): Partial<ActivityInterface> {
  const update: Partial<ActivityInterface> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.subjects !== undefined) update.subjects = body.subjects;
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.language !== undefined) update.language = body.language;
  if (body.publisher !== undefined) update.publisher = body.publisher;
  if (body.license !== undefined) update.license = body.license as any;
  if (body.visibility !== undefined) Object.assign(update, visibilityFields(body.visibility));
  return update;
}

/**
 * An activity as its create/edit screen needs it: every field an author
 * edits, the caller's role, and the collaborators by name. Owners and
 * collaborators only.
 */
async function getActivityForEditing(
  req: ZodReqWithUser<z.infer<typeof activityIDOnlySchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const activity = await Activity.findOne(
      { activityID: req.params.activityID, orgID: process.env.ORG_ID },
      {
        _id: 0, activityID: 1, h5pContentID: 1, title: 1, description: 1, library: 1, libraryTitle: 1,
        language: 1, h5pAuthors: 1, source: 1, publisher: 1, subjects: 1, tags: 1, visibility: 1,
        includeInLibrary: 1, license: 1, createdBy: 1, collaborators: 1, pendingFirstSave: 1,
        createdAt: 1, updatedAt: 1,
      }
    ).lean();
    if (!activity) return conductor404Err(res);
    if (!canEdit(activity, userUUID)) return conductorErr(res, 403, "err8");

    const people = await User.find(
      { uuid: { $in: [activity.createdBy, ...(activity.collaborators ?? [])].filter(Boolean) } },
      { _id: 0, uuid: 1, firstName: 1, lastName: 1 }
    ).lean();
    const nameOf = (uuid?: string) => {
      const u = people.find((p) => p.uuid === uuid);
      return u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "Unknown user";
    };
    const level: VisibilityLevel =
      activity.visibility === "private" ? "private" : activity.includeInLibrary === false ? "unlisted" : "public";

    const { createdBy, collaborators, ...rest } = activity;
    return res.send({
      err: false,
      activity: { ...rest, visibilityLevel: level },
      role: isOwner(activity, userUUID) ? "owner" : "collaborator",
      people: [
        ...(createdBy ? [{ uuid: createdBy, name: nameOf(createdBy), role: "owner" }] : []),
        ...(collaborators ?? []).map((uuid) => ({ uuid, name: nameOf(uuid), role: "collaborator" })),
      ],
    });
  } catch (err) {
    log.error({ err }, "getActivityForEditing failed");
    return conductor500Err(res);
  }
}

/**
 * Subjects already in use, for the Subject field. Studio's subjects
 * vocabulary arrived with the migrated activities, so it is the list.
 */
async function listActivitySubjects(_req: Request, res: Response) {
  try {
    const subjects = (await Activity.distinct("subjects", { orgID: process.env.ORG_ID }))
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
    return res.send({ err: false, subjects });
  } catch (err) {
    log.error({ err }, "listActivitySubjects failed");
    return conductor500Err(res);
  }
}

/**
 * Editor token for a new activity: opens the editor and allows uploads, but
 * cannot save anything until `createActivity` has allocated a content id.
 */
async function issueNewActivityEditorToken(req: ZodReqWithUser<{}>, res: Response) {
  try {
    if (!(await isVerifiedInstructor(req.user.decoded.uuid))) return conductorErr(res, 403, "err94");
    const { token, expiresAt } = await signCapabilityToken({
      subject: req.user.decoded.uuid,
      actions: ["create"],
    });
    return res.send({ err: false, token, expiresAt, ttlSeconds: EDITOR_TOKEN_TTL_SECONDS });
  } catch (err) {
    return authoringFailure(res, err, "issueNewActivityEditorToken");
  }
}

/**
 * Editor token for an existing activity, scoped to its H5P content. Owners and
 * collaborators get one. Delete is never in an editor token: it goes through
 * `deleteActivity`, which Conductor performs server to server.
 */
async function issueEditorToken(
  req: ZodReqWithUser<z.infer<typeof activityIDOnlySchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const activity = await Activity.findOne(
      { activityID: req.params.activityID, orgID: process.env.ORG_ID },
      { _id: 0, h5pContentID: 1, createdBy: 1, collaborators: 1 }
    ).lean();
    if (!activity) return conductor404Err(res);
    if (!canEdit(activity, userUUID)) return conductorErr(res, 403, "err8");

    const { token, expiresAt } = await signCapabilityToken({
      subject: userUUID,
      actions: ["edit"],
      contentId: activity.h5pContentID,
    });
    return res.send({
      err: false,
      token,
      expiresAt,
      ttlSeconds: EDITOR_TOKEN_TTL_SECONDS,
      h5pContentID: activity.h5pContentID,
    });
  } catch (err) {
    return authoringFailure(res, err, "issueEditorToken");
  }
}

/**
 * Creates an activity at the first Save of a new one (authoring design,
 * section 4). Conductor allocates the H5P content id first, so the link
 * between Activity and content is Conductor's from the start, and returns an
 * edit token for that id. The editor then saves its content into it, and the
 * screen reports that back with `updateActivity`'s `contentSaved`.
 *
 * New activities are private until the author chooses otherwise. Only
 * verified instructors create them.
 */
async function createActivity(
  req: ZodReqWithUser<z.infer<typeof createActivitySchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const owner = await User.findOne({ uuid: userUUID }, { _id: 0, centralID: 1, verifiedInstructor: 1 }).lean();
    if (owner?.verifiedInstructor !== true) return conductorErr(res, 403, "err94");

    const h5pContentID = await allocateH5PContentId();

    let activityID = b62(8);
    while (await Activity.exists({ activityID })) activityID = b62(8);

    const metadata = metadataUpdate(req.body);
    const activity = await Activity.create({
      activityID,
      h5pContentID,
      orgID: process.env.ORG_ID,
      title: metadata.title ?? "Untitled activity",
      ...metadata,
      ...visibilityFields(req.body.visibility ?? "private"),
      createdBy: userUUID,
      ...(owner?.centralID ? { authorCentralID: owner.centralID } : {}),
      collaborators: [],
      pendingFirstSave: true,
    });

    const { token, expiresAt } = await signCapabilityToken({
      subject: userUUID,
      actions: ["edit"],
      contentId: h5pContentID,
    });
    log.info({ activityID, h5pContentID }, "Activity created");
    return res.status(201).send({
      err: false,
      activity: { activityID: activity.activityID, h5pContentID },
      token,
      expiresAt,
      ttlSeconds: EDITOR_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    return authoringFailure(res, err, "createActivity");
  }
}

/**
 * Updates an activity's metadata, and, with `contentSaved`, records what the
 * H5P editor just saved. Owners and collaborators may update.
 *
 * Saving moves `updatedAt`, which is what ADAPT's `changed` poll reads, so
 * an edit reaches ADAPT without anything else.
 */
async function updateActivity(
  req: ZodReqWithUser<z.infer<typeof updateActivitySchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const activity = await Activity.findOne(
      { activityID: req.params.activityID, orgID: process.env.ORG_ID },
      { _id: 0, createdBy: 1, collaborators: 1 }
    ).lean();
    if (!activity) return conductor404Err(res);
    if (!canEdit(activity, userUUID)) return conductorErr(res, 403, "err8");

    const update: Record<string, unknown> = metadataUpdate(req.body);
    const unset: Record<string, 1> = {};
    const saved = req.body.contentSaved;
    if (saved) {
      // H5P's own title field is the single title (design handoff), so the
      // saved content's title wins over one sent alongside it.
      update.title = saved.title;
      update.library = saved.library;
      if (saved.license) {
        update.license = { name: saved.license, ...(saved.licenseVersion ? { version: saved.licenseVersion } : {}) };
      }
      if (saved.authors) update.h5pAuthors = JSON.stringify(saved.authors);
      unset.pendingFirstSave = 1;
    }

    const updated = await Activity.findOneAndUpdate(
      { activityID: req.params.activityID, orgID: process.env.ORG_ID },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, projection: { _id: 0, __v: 0, collaborators: 0 } }
    ).lean();
    return res.send({ err: false, activity: updated });
  } catch (err) {
    log.error({ err }, "updateActivity failed");
    return conductor500Err(res);
  }
}

/**
 * Deletes an activity and its H5P content. Owner only.
 *
 * This breaks every published embed of the activity; the screen says so
 * before calling. The content goes first, so a failure leaves the Activity in
 * place to retry rather than an Activity pointing at nothing.
 */
async function deleteActivity(
  req: ZodReqWithUser<z.infer<typeof activityIDOnlySchema>>,
  res: Response
) {
  try {
    const userUUID = req.user.decoded.uuid;
    const activity = await Activity.findOne(
      { activityID: req.params.activityID, orgID: process.env.ORG_ID },
      { _id: 0, activityID: 1, h5pContentID: 1, createdBy: 1 }
    ).lean();
    if (!activity) return conductor404Err(res);
    if (!isOwner(activity, userUUID)) return conductorErr(res, 403, "err8");

    await removeActivity(activity.activityID, activity.h5pContentID);
    log.info({ activityID: activity.activityID, h5pContentID: activity.h5pContentID }, "Activity deleted");
    return res.send({ err: false });
  } catch (err) {
    return authoringFailure(res, err, "deleteActivity");
  }
}

async function removeActivity(activityID: string, h5pContentID: number): Promise<void> {
  await deleteH5PContent(h5pContentID);
  await ActivityCollection.updateMany(
    { "subCollections.h5pContentIDs": h5pContentID },
    { $pull: { "subCollections.$[].h5pContentIDs": h5pContentID } }
  );
  await Activity.deleteOne({ activityID });
}

/**
 * Daily: deletes activities created in Conductor whose content was never
 * saved, older than a day. Someone opened New H5P, got as far as an allocated
 * id, and left. Triggered externally with the LibreTexts API key, like the
 * other daily jobs.
 */
async function cleanupAbandonedActivities(_req: Request, res: Response) {
  try {
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);
    const abandoned = await Activity.find(
      { orgID: process.env.ORG_ID, pendingFirstSave: true, createdAt: { $lt: cutoff } },
      { _id: 0, activityID: 1, h5pContentID: 1 }
    ).lean();
    let removed = 0;
    for (const a of abandoned) {
      try {
        await removeActivity(a.activityID, a.h5pContentID);
        removed += 1;
      } catch (err) {
        log.warn({ err, activityID: a.activityID }, "Could not remove abandoned activity; will retry tomorrow");
      }
    }
    log.info({ found: abandoned.length, removed }, "Abandoned activity cleanup finished");
    return res.send({ err: false, found: abandoned.length, removed });
  } catch (err) {
    return authoringFailure(res, err, "cleanupAbandonedActivities");
  }
}

export default {
  getActivityForEditing,
  listActivitySubjects,
  issueNewActivityEditorToken,
  issueEditorToken,
  createActivity,
  updateActivity,
  deleteActivity,
  cleanupAbandonedActivities,
};
