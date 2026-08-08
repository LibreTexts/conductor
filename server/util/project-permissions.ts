import type { ProjectPermissionShape } from "../api/services/project-context";
import authAPI from "../api/auth";

export function checkProjectGeneralPermission(project: ProjectPermissionShape, user: unknown) {
    // Check if the project is public or available, in which case anyone has permission to view it
    if (project.visibility === "public" || project.status === "available") {
        return true;
    }

    if (!user) return false; // fail fast if user is null or undefined

    const team = _constructProjectTeam(project);
    const userUUID = _extractUserUUID(user);

    if (!userUUID) return false; // fail fast if uuid couldn't be determined
    // check if user is in the project team
    const foundUser = team.find((uuid) => uuid === userUUID);

    // if user is found in project team, they have permission
    if (foundUser) return true;

    // if not found in project team and is an object, check if they have a privileged role in the LibreTexts org
    if (typeof user === "object") {
        // if already user object, try check directly so we can avoid extra DB call
        return authAPI.checkHasRole(user, "libretexts", ["superadmin", "support"]);
    }

    return false; // user not found in project team and no privileged role
}


export function checkProjectMemberPermission(project: ProjectPermissionShape, user: unknown) {
    if (!user) return false; // fail fast if user is null or undefined

    const team = _constructProjectTeam(project);
    const userUUID = _extractUserUUID(user);

    if (!userUUID) return false; // fail fast if uuid couldn't be determined

    // check if user is in the project team
    const foundUser = team.find((uuid) => uuid === userUUID);

    // if user is found in project team, they have permission
    if (foundUser) return true;

    // if not found in project team and is an object, check if they have a privileged role in the LibreTexts org
    if (typeof user === "object") {
        // if already user object, try check directly so we can avoid extra DB call
        return authAPI.checkHasRole(user, "libretexts", ["superadmin", "support"]);
    }

    return false; // user not found in project team and no privileged role
}

export function checkProjectAdminPermission(project: ProjectPermissionShape, user: unknown) {
    if (!user) return false; // fail fast if user is null or undefined

    const admins = _constructProjectAdmins(project);
    const userUUID = _extractUserUUID(user);

    if (!userUUID) return false; // fail fast if uuid couldn't be determined

    // check if user is in the project admins
    const foundUser = admins.find((uuid) => uuid === userUUID);

    // if user is found in project admins, they have permission
    if (foundUser) return true;

    // if not found in project admins and is an object, check if they have a privileged role in the LibreTexts org
    if (typeof user === "object") {
        // if already user object, try check directly so we can avoid extra DB call
        return authAPI.checkHasRole(user, "libretexts", ["superadmin", "support"]);
    }

    return false;
}

/**
 * Constructs a unique list of all team members (leads, liaisons, members, auditors) for a given project.
 * @param project The project object containing team member information.
 * @param exclude Optional UUID or list of UUIDs to exclude from the team.
 * @returns A unique list of team member UUIDs, excluding any specified in the `exclude` parameter.
 */
function _constructProjectTeam(project: ProjectPermissionShape, exclude?: string | string[]): string[] {
    const team: string[] = [];
    if (project.leads && Array.isArray(project.leads)) {
        team.push(...project.leads);
    }
    if (project.liaisons && Array.isArray(project.liaisons)) {
        team.push(...project.liaisons);
    }
    if (project.members && Array.isArray(project.members)) {
        team.push(...project.members);
    }
    if (project.auditors && Array.isArray(project.auditors)) {
        team.push(...project.auditors);
    }

    const uniqueTeam = Array.from(new Set(team)); // remove duplicates

    if (exclude) {
        const excludeArray = Array.isArray(exclude) ? exclude : [exclude];
        return uniqueTeam.filter((uuid) => !excludeArray.includes(uuid));
    }

    return uniqueTeam;
}

/**
 * Constructs a unique list of project admins (leads and liaisons) for a given project.
 * @param project The project object containing leads and liaisons arrays.
 * @returns A unique list of project admin UUIDs.
 */
function _constructProjectAdmins(project: ProjectPermissionShape): string[] {
    const admins: string[] = [];
    if (project.leads && Array.isArray(project.leads)) {
        admins.push(...project.leads);
    }
    if (project.liaisons && Array.isArray(project.liaisons)) {
        admins.push(...project.liaisons);
    }
    const uniqueAdmins = Array.from(new Set(admins)); // remove duplicates
    return uniqueAdmins;
}

/**
 * Extracts the UUID from a user object or string. Returns null if the UUID cannot be determined.
 * The object should have either a `uuid` property or a `decoded` property containing an object with a `uuid` property.
 * i.e. the shape of req.user from the auth middleware.
 * @param user The user object or string from which to extract the UUID.
 * @returns The extracted UUID as a string, or null if it cannot be determined.
 */
function _extractUserUUID(user: unknown): string | null {
    if (!user) return null;

    if (typeof user === "string") {
        return user;
    } else if (typeof user === "object") {
        if ("uuid" in user && typeof user.uuid === "string") {
            return user.uuid;
        } else if ("decoded" in user && user.decoded && typeof user.decoded === "object") {
            if ("uuid" in user.decoded && typeof user.decoded.uuid === "string") {
                return user.decoded.uuid;
            }
        }
    }

    return null;
}