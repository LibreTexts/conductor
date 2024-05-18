import { model, Schema, Document } from "mongoose";

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
  | "password"
  | "customAvatar"
  | "isSystem"
>;

/**
 * Query SELECT params to ignore sensitive data
 */
export const SanitizedUserSelectQuery =
  "-password -customAvatar -authType -roles -isSystem";

export const SanitizedUserSelectProjection = {
  password: 0,
  customAvatar: 0,
  authType: 0,
  roles: 0,
  isSystem: 0,
}

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

UserSchema.index({
  firstName: 1
})

UserSchema.index({
  email: "text",
  firstName: "text",
  lastName: "text",
});

UserSchema.index({
  centralID: 1,
  firstName: 1,
  lastName: 1,
  uuid: 1,
})

const User = model<UserInterface>("User", UserSchema);

export default User;
