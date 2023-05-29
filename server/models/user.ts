import { model, Schema, Document } from "mongoose";

export type UserInterface = Document & {
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  hash?: string;
  salt?: string;
  roles?: {
    org?: string;
    role?: string;
  }[];
  authType?: "traditional" | "sso";
  authSub?: string;
  lastResetAttempt?: Date;
  resetToken?: string;
  tokenExpiry?: Date;
  customAvatar?: boolean;
  pinnedProjects?: string[];
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
};

export type SanitizedUserInterface = Omit<
  UserInterface,
  | "hash"
  | "salt"
  | "authSub"
  | "lastResetAttempt"
  | "resetToken"
  | "tokenExpiry"
  | "customAvatar"
  | "isSystem"
>;

/**
 * Query SELECT params to ignore sensitive data
 */
export const SanitizedUserSelectQuery =
  "-hash -salt -authSub -lastResetAttempt -resetToken -tokenExpiry -customAvatar -authType -roles -isSystem";

const UserSchema = new Schema<UserInterface>(
  {
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
    avatar: String,
    hash: String,
    salt: String,
    roles: [
      {
        org: String,
        role: String,
      },
    ],
    authType: String, // the original authentication type, one of ['traditional', 'sso']
    authSub: String, // the 'sub' field from the SSO service
    lastResetAttempt: Date, // the datetime of the last password reset attempt
    resetToken: String, // the cryptographically-generated active reset token
    tokenExpiry: Date, // the datetime that the @resetToken is no longer valid
    customAvatar: Boolean, // if the user has set their own avatar
    pinnedProjects: [String], // UUIDs of 'pinned' projects
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
  },
  {
    timestamps: true,
  }
);

const User = model<UserInterface>("User", UserSchema);

export default User;
