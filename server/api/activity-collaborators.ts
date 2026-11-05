import { Response } from "express";
import { z } from "zod";
import { childLogger } from "../logger.js";
import Activity from "../models/activity.js";
import User from "../models/user.js";
import { conductor404Err, conductor500Err, conductorErr } from "../util/errorutils.js";
import {
  MAX_ACTIVITY_COLLABORATORS,
  activityViewerRole,
  canManageActivityCollaborators,
} from "../util/activity-permissions.js";
import { buildActivityPeople } from "./activity-authoring.js";
import mailAPI from "./mail.js";
import SearchService from "./services/search-service.js";
import {
  activityCollaboratorSchema,
  searchActivityCollaboratorsSchema,
} from "./validators/activities.js";
import { ZodReqWithUser } from "../types";

const log = childLogger("activity-collaborators");

/** The activity with what every collaborator call checks against. */
async function findActivity(activityID: string) {
  return Activity.findOne(
    { activityID: { $eq: activityID }, orgID: process.env.ORG_ID },
    { _id: 0, activityID: 1, title: 1, createdBy: 1, collaborators: 1 }
  ).lean();
}

/**
 * Tells the added person, without holding up the add. Mail is a nicety here:
 * a failed send is logged and the collaborator stays added.
 */
async function notifyAdded(
  activity: { activityID: string; title: string },
  addedUUID: string,
  addedByUUID: string
) {
  const [added, addedBy] = await Promise.all([
    User.findOne({ uuid: addedUUID }, { _id: 0, email: 1, firstName: 1 }).lean(),
    User.findOne({ uuid: addedByUUID }, { _id: 0, firstName: 1, lastName: 1 }).lean(),
  ]);
  if (!added?.email) return;
  await mailAPI.sendAddedAsActivityCollaboratorNotification(
    added.firstName,
    added.email,
    activity.activityID,
    activity.title,
    [addedBy?.firstName, addedBy?.lastName].filter(Boolean).join(" ") || "A LibreTexts user"
  );
}

/**
 * Users an owner or staff member may add, searched by name. The owner and
 * current collaborators are left out. `emailDomain` is returned so similarly
 * named people can be told apart, as in project team search.
 */
async function searchCollaboratorCandidates(
  req: ZodReqWithUser<z.infer<typeof searchActivityCollaboratorsSchema>>,
  res: Response
) {
  try {
    const activity = await findActivity(req.params.activityID);
    if (!activity) return conductor404Err(res);
    if (!canManageActivityCollaborators(activityViewerRole(activity, req.user))) {
      return conductorErr(res, 403, "err8");
    }

    const { search, limit } = req.query;
    const existing = [activity.createdBy, ...(activity.collaborators ?? [])].filter(
      (v): v is string => Boolean(v)
    );
    const searchService = await SearchService.getInstance();
    const results = await searchService.search(
      "users",
      search,
      existing.length ? { $not: { uuid: { $in: existing } } } : undefined,
      // With no query, an alphabetical listing; with one, relevance ranking.
      search ? undefined : [{ field: "firstName", order: "asc" }],
      {
        limit,
        attributesToRetrieve: ["uuid", "firstName", "lastName", "avatar", "emailDomain"],
      }
    );
    return res.send({ err: false, users: results.hits ?? [] });
  } catch (err) {
    log.error({ err }, "searchCollaboratorCandidates failed");
    return conductor500Err(res);
  }
}

/**
 * Adds a collaborator. Owners and LibreTexts staff only. Adding someone who
 * already collaborates succeeds without change.
 */
async function addCollaborator(
  req: ZodReqWithUser<z.infer<typeof activityCollaboratorSchema>>,
  res: Response
) {
  try {
    const { activityID, uuid } = req.params;
    const activity = await findActivity(activityID);
    if (!activity) return conductor404Err(res);
    const role = activityViewerRole(activity, req.user);
    if (!canManageActivityCollaborators(role)) return conductorErr(res, 403, "err8");

    const collaborators = activity.collaborators ?? [];
    if (uuid === activity.createdBy) return conductorErr(res, 400, "err1");
    if (collaborators.includes(uuid)) {
      return res.send({ err: false, people: await buildActivityPeople(activity.createdBy, collaborators) });
    }
    if (collaborators.length >= MAX_ACTIVITY_COLLABORATORS) return conductorErr(res, 400, "err95");
    if (!(await User.exists({ uuid: { $eq: uuid } }))) return conductorErr(res, 400, "err7");

    // The cap is part of the match, so two adds racing past the check above
    // cannot both land on a full list.
    const updated = await Activity.findOneAndUpdate(
      {
        activityID: { $eq: activityID },
        orgID: process.env.ORG_ID,
        [`collaborators.${MAX_ACTIVITY_COLLABORATORS - 1}`]: { $exists: false },
      },
      { $addToSet: { collaborators: uuid } },
      { new: true, projection: { _id: 0, createdBy: 1, collaborators: 1 } }
    ).lean();
    if (!updated) return conductorErr(res, 400, "err95");

    log.info({ activityID, collaborator: uuid, actingAs: role }, "Collaborator added");
    void notifyAdded(activity, uuid, req.user.decoded.uuid).catch((err) =>
      log.warn({ err, activityID }, "Collaborator notification failed")
    );

    return res.send({
      err: false,
      people: await buildActivityPeople(updated.createdBy, updated.collaborators),
    });
  } catch (err) {
    log.error({ err }, "addCollaborator failed");
    return conductor500Err(res);
  }
}

/**
 * Removes a collaborator. Owners and LibreTexts staff remove anyone but the
 * owner; a collaborator may remove only themselves, which `left` reports so
 * the screen can leave an activity the caller can no longer edit.
 */
async function removeCollaborator(
  req: ZodReqWithUser<z.infer<typeof activityCollaboratorSchema>>,
  res: Response
) {
  try {
    const { activityID, uuid } = req.params;
    const activity = await findActivity(activityID);
    if (!activity) return conductor404Err(res);
    const role = activityViewerRole(activity, req.user);
    const leaving = role === "collaborator" && uuid === req.user.decoded.uuid;
    if (!leaving && !canManageActivityCollaborators(role)) return conductorErr(res, 403, "err8");
    if (uuid === activity.createdBy) return conductorErr(res, 400, "err1");

    const updated = await Activity.findOneAndUpdate(
      { activityID: { $eq: activityID }, orgID: process.env.ORG_ID },
      { $pull: { collaborators: uuid } },
      { new: true, projection: { _id: 0, createdBy: 1, collaborators: 1 } }
    ).lean();
    if (!updated) return conductor404Err(res);

    log.info({ activityID, collaborator: uuid, actingAs: leaving ? "self" : role }, "Collaborator removed");
    return res.send({
      err: false,
      people: await buildActivityPeople(updated.createdBy, updated.collaborators),
      ...(leaving ? { left: true } : {}),
    });
  } catch (err) {
    log.error({ err }, "removeCollaborator failed");
    return conductor500Err(res);
  }
}

export default {
  searchCollaboratorCandidates,
  addCollaborator,
  removeCollaborator,
};
