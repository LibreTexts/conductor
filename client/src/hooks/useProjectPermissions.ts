import { useMemo } from "react";
import { Project, User } from "../types";
import {
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
} from "../components/util/ProjectHelpers";

export type ProjectPermissions = {
  /** Lead, liaison, SuperAdmin, or Support. */
  isAdmin: boolean;
  /** Admin, member, or SuperAdmin. */
  isMember: boolean;
  /** Member, or an auditor on the team. */
  canViewDetails: boolean;
};

const NO_PERMISSIONS: ProjectPermissions = {
  isAdmin: false,
  isMember: false,
  canViewDetails: false,
};

/**
 * Derives the current user's permissions within a project. Admin implies member,
 * and member implies canViewDetails.
 */
const useProjectPermissions = (
  project: Project | undefined,
  user: User | undefined
): ProjectPermissions => {
  return useMemo(() => {
    if (!project || !user?.uuid) return NO_PERMISSIONS;
    const isAdmin = checkProjectAdminPermission(project, user);
    const isMember = isAdmin || checkProjectMemberPermission(project, user);
    const canViewDetails = isMember || checkCanViewProjectDetails(project, user);
    return { isAdmin, isMember, canViewDetails };
  }, [project, user]);
};

export default useProjectPermissions;
