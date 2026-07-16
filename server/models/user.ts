import { model, Schema, Document } from "mongoose";

export type UXAcknowledgmentStatus = "seen" | "dismissed" | "completed";

/**
 * A record of a single one-off UI prompt (banner, welcome dialog, tour, hint)
 * that a user has seen, dismissed, or completed. Keyed by a stable
 * acknowledgment id from the shared key registry (util/uxAcknowledgmentKeys).
 */
export type UXAcknowledgmentEntry = {
  status: UXAcknowledgmentStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  dismissedAt?: Date;
  completedAt?: Date;
  viewCount: number;
  dismissCount: number;
  data?: Record<string, unknown>; // flexible meta (tour step, variant, etc.)
};

export type UserInterface = Document & {
  centralID: string;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  authType?: "traditional" | "sso";
  password?: string;
  avatar?: string;
  roles?: {
    org?: string;
    role?: string;
  }[];
  customAvatar?: boolean;
  pinnedProjects?: {
    folder: string;
    projects: string[];
  }[];
  authorizedApps?: {
    clientID: string;
    authorizedAt: Date;
  }[];
  isSystem?: boolean;
  instructorProfile?: {
    institution?: string;
    facultyURL?: string;
  };
  verifiedInstructor?: boolean;
  /**
   * Generic per-user record of one-off UI prompts (banners, tours, welcome
   * dialogs) the user has seen, dismissed, or completed. Keyed by a stable
   * acknowledgment id from the shared key registry.
   */
  uxAcknowledgments?: Map<string, UXAcknowledgmentEntry>;
};

export type SanitizedUserInterface = Omit<
  UserInterface,
  | "password"
  | "customAvatar"
  | "isSystem"
>;

/**
 * Query SELECT params to ignore sensitive data
 */
export const SanitizedUserSelectQuery =
  "-password -customAvatar -authType -roles -isSystem -salt -hash -pinnedProjects -authorizedApps -lastResetAttempt -resetToken -tokenExpiry -uxAcknowledgments";

export const SanitizedUserSelectProjection = {
  _id: 0,
  password: 0,
  customAvatar: 0,
  authType: 0,
  roles: 0,
  isSystem: 0,
  salt: 0,
  hash: 0,
  uxAcknowledgments: 0,
};

export const DEFAULT_PINNED_PROJECTS = [
  {
    folder: "Default",
    projects: [],
  },
]

const UXAcknowledgmentEntrySchema = new Schema<UXAcknowledgmentEntry>(
  {
    status: {
      type: String,
      enum: ["seen", "dismissed", "completed"],
      required: true,
    },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    dismissedAt: { type: Date },
    completedAt: { type: Date },
    viewCount: { type: Number, required: true, default: 0 },
    dismissCount: { type: Number, required: true, default: 0 },
    data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const UserSchema = new Schema<UserInterface>(
  {
    centralID: {
      type: String,
      required: true, // set 'system' for fallback authentication
      unique: true,
    },
    uuid: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    authType: String, // one of ['traditional', 'sso']
    password: String, // only used for fallback authentication
    avatar: String,
    roles: [
      {
        org: String,
        role: String,
      },
    ],
    customAvatar: Boolean, // if the user has set their own avatar
    pinnedProjects: {
      type: [
        {
          folder: {
            type: String,
            required: true,
          },
          projects: [String],
        },
      ],
      default: [
        {
          folder: "Default",
          projects: [],
        },
      ],
    },
    /**
     * API Client applications the user has authorized to access their account.
     */
    authorizedApps: [
      {
        /**
         * API Client internal identifier.
         */
        clientID: {
          type: String,
          required: true,
        },
        /**
         * Date the User authorized (or re-authorized) the API Client.
         */
        authorizedAt: {
          type: Date,
          required: true,
        },
      },
    ],
    /**
     * Indicates the "user" is a system account and should not be directly accessed, nor shown
     * in lists of users and team members.
     */
    isSystem: Boolean,
    /**
     * Information about the user's status as an instructor an academic institution.
     */
    instructorProfile: {
      /**
       * Name of the academic institution.
       */
      institution: String,
      /**
       * URL pointing to a website that verifies the user's status at the institution.
       */
      facultyURL: String,
    },
    /**
     * Indicates a LibreTexts team member has verified the user's status
     * at an academic institution.
     */
    verifiedInstructor: Boolean,
    /**
     * Generic per-user record of one-off UI prompts (dismissible banners,
     * welcome dialogs, tours, hints) the user has seen, dismissed, or
     * completed. Keyed by a stable acknowledgment id from the shared key
     * registry (util/uxAcknowledgmentKeys). Persisted here so it survives
     * across devices and browsers.
     */
    uxAcknowledgments: {
      type: Map,
      of: UXAcknowledgmentEntrySchema,
      default: undefined, // don't auto-create an empty map on every user
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({
  firstName: 1
})

UserSchema.index({
  lastName: 1
})

UserSchema.index({
  email: "text",
  firstName: "text",
  lastName: "text",
});

UserSchema.index({
  uuid: 1,
})

UserSchema.index({
  centralID: 1,
  firstName: 1,
  lastName: 1,
  uuid: 1,
})

const User = model<UserInterface>("User", UserSchema);

export default User;
