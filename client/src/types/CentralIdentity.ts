export type CentralIdentitySystem = {
  id: number;
  logo: string | null;
  name: string;
};

export type CentralIdentityOrg = {
  id: number;
  logo: string | null;
  name: string;
  system?: CentralIdentitySystem;
};

export type CentralIdentityService = {
  service_Id: string;
  name: string;
  body: string;
  evaluation_Order: number;
  evaluation_Priority: number;
};

export type CentralIdentityUser = {
  active: boolean;
  avatar: string | null;
  bio_url?: string | null;
  createdAt: string;
  disabled: boolean | null;
  email: string;
  enabled: boolean;
  expired: boolean | null;
  external_idp: string | null;
  external_subject_id: string | null;
  first_name: string;
  last_name: string;
  last_password_change: string | null;
  legacy: boolean;
  organizations: CentralIdentityOrg[];
  registration_complete: boolean | null;
  updatedAt: string | null;
  user_type: "student" | "instructor";
  uuid: string;
  verify_status:
    | "not_attempted"
    | "pending"
    | "needs_review"
    | "denied"
    | "verified";
};
