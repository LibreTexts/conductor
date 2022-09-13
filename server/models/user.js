//
// LibreTexts Conductor
// user.js
// Mongoose Model
//

import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    avatar: String,
    hash: String,
    salt: String,
    roles: [{
        org: String,
        role: String
    }],
    authType: String,           // the original authentication type, one of ['traditional', 'sso']
    authSub: String,            // the 'sub' field from the SSO service
    lastResetAttempt: Date,     // the datetime of the last password reset attempt
    resetToken: String,         // the cryptographically-generated active reset token
    tokenExpiry: Date,          // the datetime that the @resetToken is no longer valid
    customAvatar: Boolean,      // if the user has set their own avatar
    pinnedProjects: [String],   // UUIDs of 'pinned' projects
    /**
     * API Client applications the user has authorized to access their account.
     */
    authorizedApps: [{
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
    }],
    /**
     * Indicates the "user" is a system account and should not be directly accessed, nor shown
     * in lists of users and team members.
     */
    isSystem: Boolean,
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

export default User;
