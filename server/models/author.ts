import { Schema, model, Document } from "mongoose";

/**
 * Shown for an individual author with no picture of their own. It is never stored on the
 * record, so an admin can tell "no picture" apart and replace it at any time. Groups get no
 * default: one person's silhouette would misrepresent several people.
 */
export const DEFAULT_AUTHOR_PICTURE_URL =
  "https://biz.libretexts.org/@api/deki/files/5084/girl-160172__340.png";

/** The author with the default picture filled in when an individual has none. */
export function withDefaultPicture<T extends { pictureURL?: string; groupMembers?: unknown[] }>(
  author: T,
): T {
  if (author.pictureURL || author.groupMembers?.length) return author;
  return { ...author, pictureURL: DEFAULT_AUTHOR_PICTURE_URL };
}

export interface AuthorGroupMember {
  nameKey: string;
  campusName?: string;
  campusURL?: string;
  programName?: string;
  programURL?: string;
}

export interface AuthorInterface extends Document {
  orgID: string;
  nameKey: string; // A normalized version of the name for indexing and searching. Must be unique within an orgID.
  name: string;
  nameURL?: string;
  note?: string;
  noteURL?: string;
  campusName?: string;
  campusURL?: string;
  pictureCircle?: string; // i.e. "yes" or "no"
  pictureURL?: string;
  programName?: string;
  programURL?: string;
  attributionPrefix?: string;
  userUUID?: string; // Optional field if the user uuid of the matching author is known
  /**
   * Set only on a group: the individual authors it stands for, in display order. A group is
   * itself an Author (its `nameKey` is the group key), so a page tagged with it keeps working
   * for anything that only understands single authors. Each membership may override the
   * member's affiliation for this group only; the individual's own record is never changed.
   * Groups are one level deep: a member can't itself be a group.
   */
  groupMembers?: AuthorGroupMember[];
  /** Groups only. When not false, `name` is derived from the members' current names. */
  autoName?: boolean;
}

const GroupMemberSchema = new Schema<AuthorGroupMember>(
  {
    nameKey: { type: String, required: true },
    campusName: { type: String, required: false },
    campusURL: { type: String, required: false },
    programName: { type: String, required: false },
    programURL: { type: String, required: false },
  },
  { _id: false }
);

const AuthorSchema = new Schema<AuthorInterface>({
  orgID: {
    type: String,
    required: true,
  },
  nameKey: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  nameURL: {
    type: String,
    required: false,
  },
  note: {
    type: String,
    required: false,
  },
  noteURL: {
    type: String,
    required: false,
  },
  campusName: {
    type: String,
    required: false,
  },
  campusURL: {
    type: String,
    required: false,
  },
  pictureCircle: {
    type: String,
  },
  pictureURL: {
    type: String,
    required: false,
  },
  programName: {
    type: String,
    required: false,
  },
  programURL: {
    type: String,
    required: false,
  },
  attributionPrefix: {
    type: String,
    required: false,
  },
  userUUID: {
    type: String,
    required: false,
  },
  groupMembers: {
    type: [GroupMemberSchema],
    required: false,
    default: undefined, // Leave absent on individual authors rather than storing []
  },
  autoName: {
    type: Boolean,
    required: false,
  },
});

AuthorSchema.index({ orgID: 1, nameKey: 1 }, { unique: true }); // Ensure nameKey is unique within an orgID
AuthorSchema.index({ orgID: 1, "groupMembers.nameKey": 1 }, { sparse: true }); // Which groups is an author in?


const Author = model<AuthorInterface>("Author", AuthorSchema);

export default Author;
