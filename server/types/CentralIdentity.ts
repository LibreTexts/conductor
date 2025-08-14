export type CentralIdentitySystem = {
  id: number;
  logo: string | null;
  name: string;
  createdAt: string;
  updatedAt: string | null;
  organizations: CentralIdentityOrg[];
};

export type CentralIdentityOrg = {
  id: number;
  logo: string | null;
  name: string;
  system_id?: number;
  system?: CentralIdentitySystem;
};

export type CentralIdentityService = {
  service_Id: string;
  name: string;
  body: string;
  evaluation_Order: number;
  evaluation_Priority: number;
};

export type CentralIdentityApp = {
  id: number;
  name: string;
  app_type: "standalone" | "library";
  main_url: string;
  cas_service_url: string;
  default_access: "all" | "instructors" | "none";
  icon: string;
  description: string;
  primary_color: string;
  hide_from_apps: boolean;
  hide_from_user_apps: boolean;
  is_default_library: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CentralIdentityUser = {
  academy_online: number;
  academy_online_expires: string | null;
  active: boolean;
  avatar: string | null;
  bio_url?: string | null;
  createdAt: string;
  disabled: boolean | null;
  disabled_reason?: string | null;
  disabled_date?: string | null;
  email: string;
  enabled: boolean;
  expired: boolean | null;
  external_idp: string | null;
  external_subject_id: string | null;
  first_name: string;
  lang: string;
  last_name: string;
  last_password_change: string | null;
  legacy: boolean;
  organizations: CentralIdentityOrg[];
  registration_complete: boolean | null;
  updatedAt: string | null;
  user_type: "student" | "instructor";
  student_id?: string;
  uuid: string;
  verify_status:
  | "not_attempted"
  | "pending"
  | "needs_review"
  | "denied"
  | "verified";
};

export type CentralIdentityVerificationRequest = {
  user_id: string;
  status: CentralIdentityVerificationRequestStatus;
  bio_url?: string;
  addtl_info?: string;
  decision_reason?: string;
  created_at: Date;
  updated_at: Date;
  user: Pick<CentralIdentityUser, "first_name" | "last_name" | "email" | "uuid">;
};

export type CentralIdentityVerificationRequestStatus = 'approved' | 'denied' | 'needs_change' | 'open';

export type CentralIdentityAccessRequestChangeEffect = 'deny' | 'approve' | 'request_change';

export type CentralIdentityUpdateVerificationRequestBody = {
  effect: CentralIdentityAccessRequestChangeEffect;
  reason?: string;
  approved_applications?: number[];
};

export type CentralIdentityLicense = {
  name: string;
  versions?: string[];
  url?: string;
  created_at: Date;
  updated_at: Date;
}

export type User = {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type Note = {
  uuid: string;
  content: string;
  updated_at: string;
  created_at: string;
  created_by_id: string;
  created_by_user: User;
  updated_by_id: string;
  updated_by_user: User;
  user_id: string;
};

export type CentralIdentityAppLicense = {
  uuid: string;
  name: string;
  stripe_id: string | null;
  picture_url: string | null;
  perpetual: boolean;
  trial: boolean;
  is_academy_license: boolean;
  academy_level: number;
  duration_days: number;
  created_at: string;
  updated_at: string;
}

export type CentralIdentityOrgAppLicense = {
  application_license_id: string;
  org_id: number;
  original_purchase_date: string;
  last_renewed_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CentralIdentityUserAppLicense = {
  uuid: string;
  user_id: string;
  application_license_id: string;
  original_purchase_date: string;
  last_renewed_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CentralIdentityUserLicenseResult = CentralIdentityUserAppLicense & {
  granted_by: 'self'
  application_license: CentralIdentityAppLicense;
} | CentralIdentityOrgAppLicense & {
  granted_by: 'org';
  application_license: CentralIdentityAppLicense;
}