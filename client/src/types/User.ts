import { Organization } from "./Organization";
import { Project } from "./Project";

export type User = {
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  roles: {
    org: Organization | string;
    role: string;
  }[];
  authType: string;
  pinnedProjects?: {
    folder: string;
    projects: (string | Pick<Project, "orgID" | "projectID" | "title" | "updatedAt">)[];
  }[];
  authorizedApps?: AuthorizedApp[];
  instructorProfile?: {
    institution: string;
    facultyURL: string;
  };
  organizations: Organization[];
  isAuthenticated: boolean;
  verifiedInstructor: boolean;
  isCampusAdmin: boolean;
  isSuperAdmin: boolean;
  isSupport: boolean;
  isHarvester: boolean;
  createdAt?: string;
};

export type Account = Pick<
  User,
  | "avatar"
  | "authType"
  | "firstName"
  | "lastName"
  | "email"
  | "roles"
  | "verifiedInstructor"
  | "instructorProfile"
  | "createdAt"
>;

export type AuthorizedApp = {
  clientID: string;
  authorizedAt: string;
  name: string;
  infoURL: string;
  icon: string;
};

export type UserWCentralID = User & {
  centralID?: string;
};
