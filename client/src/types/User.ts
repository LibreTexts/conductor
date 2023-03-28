export type User = {
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string;
  roles: [
    {
      org: string;
      role: string;
    }
  ];
  authType: string;
  pinnedProjects?: [string];
  authorizedApps?: [
    {
      clientID: string;
      authorizedAt: string;
    }
  ];
  instructorProfile?: {
    institution: string;
    facultyURL: string;
  };
  isAuthenticated: boolean;
  isVerifiedInstructor: boolean;
  isCampusAdmin: boolean;
  isSuperAdmin: boolean;
};
