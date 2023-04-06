import { Organization } from "./Organization";

export type User = {
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  roles: [
    {
      org: Organization;
      role: string;
    }
  ];
  authType: string;
  pinnedProjects?: [string];
  authorizedApps?: AuthorizedApp[];
  instructorProfile?: {
    institution: string;
    facultyURL: string;
  };
  isAuthenticated: boolean;
  isVerifiedInstructor: boolean;
  isCampusAdmin: boolean;
  isSuperAdmin: boolean;
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
  | "isVerifiedInstructor"
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
