/**
 * @file Defines a Mongoose schema for storing invitations to join/access Analytics "Courses".
 * @author LibreTexts <info@libretexts.org>
 */
import mongoose from 'mongoose';

const AnalyticsInviteSchema = new mongoose.Schema({
  /**
   * Identifier of the course being shared.
   */
  courseID: {
    type: String,
    required: true,
  },
  /**
   * Indicates the invitation has been accepted (and was not expired).
   */
  accepted: Boolean,
  /**
   * Date when the invitation was accepted.
   */
  acceptedAt: Date,
  /**
   * The Date after which the invitation is no longer valid, if not accepted.
   */
  expiresAt: {
    type: Date,
    required: true,
  },
  /**
   * UUID of the user who created the invitation.
   */
  sender: {
    type: String,
    required: true,
  },
  /**
   * UUID of the invitee.
   */
  invitee: {
    type: String,
    required: true,
  },
  /**
   * Role to assign the invitee in the course if the invitation is accepted.
   */
  newRole: {
    type: String,
    required: true,
    enum: ['instructor', 'viewer'],
  },
}, {
  timestamps: true,
});

const AnalyticsInvite = mongoose.model('AnalyticsInvite', AnalyticsInviteSchema);

export default AnalyticsInvite;
