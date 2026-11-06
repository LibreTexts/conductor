import authAPI from "../api/auth.js";
import { ActivityInterface } from "../models/activity.js";
import { TypedReqUser } from "../types/Express.js";

/**
 * Why the caller may edit an activity: they own it, collaborate on it, or hold
 * a LibreTexts support role (superadmins included). Owner wins over the
 * others, so an author who is also staff is told they're the author.
 */
export type ActivityViewerRole = "owner" | "collaborator" | "staff";

type ActivityUser = Partial<Pick<TypedReqUser, "decoded" | "roles">>;

export function isActivityOwner(activity: Pick<ActivityInterface, "createdBy">, userUUID?: string): boolean {
  return Boolean(activity.createdBy) && Boolean(userUUID) && activity.createdBy === userUUID;
}

/**
 * LibreTexts support staff, which `checkHasRole` extends to superadmins. False
 * when roles were never loaded, so a route missing `getUserAttributes` fails
 * closed rather than open.
 */
export function isActivityStaff(user?: ActivityUser): boolean {
  if (!user?.roles) return false;
  return authAPI.checkHasRole(user, "libretexts", "support", true);
}

/** The caller's edit role on an activity, or undefined when they have none. */
export function activityViewerRole(
  activity: Pick<ActivityInterface, "createdBy" | "collaborators">,
  user?: ActivityUser
): ActivityViewerRole | undefined {
  const userUUID = user?.decoded?.uuid;
  if (isActivityOwner(activity, userUUID)) return "owner";
  if (userUUID && (activity.collaborators ?? []).includes(userUUID)) return "collaborator";
  if (isActivityStaff(user)) return "staff";
  return undefined;
}

/** Studio capped collaborators at 10, and Conductor keeps that cap. */
export const MAX_ACTIVITY_COLLABORATORS = 10;

/** Owners and LibreTexts staff manage who may edit. Collaborators may only leave. */
export function canManageActivityCollaborators(role?: ActivityViewerRole): boolean {
  return role === "owner" || role === "staff";
}
