import { model, Schema, Document } from "mongoose";
import { License } from "../types";

export const ACTIVITY_VISIBILITY_SETTINGS = ["public", "private"];

export const ACTIVITY_DATA_CLASSES = ["production", "synthetic"];

export type ActivityDataClass = "production" | "synthetic";

export type ActivityVisibility = "public" | "private";

export interface RawActivityInterface {
  activityID: string;
  h5pContentID: number;
  orgID: string;
  authorCentralID?: string;
  title: string;
  description?: string;
  library?: string;
  h5pAuthors?: string;
  source?: string;
  adaptID?: string;
  adaptIDCheckedAt?: Date;
  createdBy?: string;
  collaborators?: string[];
  publisher?: string;
  subjects?: string[];
  tags?: string[];
  screenshots?: string[];
  visibility: ActivityVisibility;
  dataClass: ActivityDataClass;
  includeInLibrary?: boolean;
  includeInProfile?: boolean;
  license?: License;
  language?: string;
  libraryTitle?: string;
  legacyLibraryID?: number;
  legacyNodeID?: number;
  legacyNodeUUID?: string;
  pendingFirstSave?: boolean;
}

export interface ActivityInterface extends RawActivityInterface, Document {}

const ActivitySchema = new Schema<ActivityInterface>(
  {
    /**
     * Unique Conductor-side identifier of the activity.
     */
    activityID: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Identifier of the H5P content this activity wraps, as assigned by the H5P
     * service.
     *
     * This is the integer Studio used as `h5p_content.id`, carried over verbatim
     * during migration. Published textbook embeds (`/h5p/{id}/embed`) and the
     * ADAPT question-bank lookup both address activities by this number, so it is
     * a public contract and must never be regenerated.
     */
    h5pContentID: {
      type: Number,
      required: true,
      unique: true,
    },
    /**
     * Identifier of the organization the activity belongs to.
     */
    orgID: {
      type: String,
      required: true,
      index: true,
    },
    /**
     * UI-name of the activity.
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * Instructor-facing overview. Migrated from the Studio node body.
     */
    description: String,
    /**
     * H5P library string the activity runs on, e.g. "H5P.MultiChoice 1.16".
     * Denormalized from the H5P service so the catalog can filter and badge by
     * content type without a per-row call out to it.
     */
    library: {
      type: String,
      index: true,
    },
    /**
     * Display title of the H5P library, e.g. "Interactive Video". Studio's API
     * served it as `type`, and ADAPT matches on these exact names: it treats
     * "Interactive Video" and "Question Set" as activity sets. Kept verbatim
     * rather than derived from `library`, which carries only the machine name.
     */
    libraryTitle: String,
    /**
     * Language code of the H5P content, from Studio's `default_language`.
     */
    language: String,
    /**
     * Author credit carried inside the H5P package metadata. Distinct from
     * `createdBy`, which is the Conductor account that owns the record.
     */
    h5pAuthors: String,
    /**
     * Original source URL declared in the H5P package metadata.
     */
    source: String,
    /**
     * ADAPT question identifier corresponding to this activity, cached from
     * ADAPT's lookup endpoint. Exposed in the ADAPT reconciliation feed.
     */
    adaptID: {
      type: String,
      index: true,
    },
    /**
     * When the ADAPT id sync last asked ADAPT about this activity. The sync
     * takes the least recently checked first. See `adapt-id-sync-service.ts`.
     */
    adaptIDCheckedAt: Date,
    /**
     * LibreOne UUID of the author. Authoritative.
     *
     * LibreOne is the identity source of record across LibreTexts, and this is
     * the one author identifier that means the same thing in Studio, Conductor
     * and ADAPT. It is always set, even when the person has no Conductor
     * account, so attribution never depends on a local record existing.
     */
    authorCentralID: {
      type: String,
      index: true,
    },
    /**
     * Conductor-local UUID of the user that owns the activity, when one exists.
     *
     * Nullable on purpose. The Studio survey found 87 authors holding 459
     * activities who have a valid LibreOne identity but have never logged into
     * Conductor, so no local `User` row exists for them. Provisioning accounts
     * as a side effect of a content import would be the wrong trade, so
     * `authorCentralID` carries the attribution and this fills in when they
     * first sign in, via the LibreOne user-created lifecycle webhook.
     *
     * Consequence worth knowing: ownership checks match on this field, so an
     * author in that state cannot see their own private activity until the
     * backfill runs. Studio has exactly one private node in total, so the
     * exposure is theoretical rather than practical.
     */
    createdBy: {
      type: String,
      index: true,
    },
    /**
     * Conductor-local UUIDs of users granted edit access by the owner, resolved
     * from LibreOne UUIDs the same way as `createdBy`. Studio capped this at 10
     * and had no invitation flow; the cap is enforced in the validator.
     */
    collaborators: {
      type: [String],
      default: [],
      // My H5P matches on owner or collaborator.
      index: true,
    },
    /**
     * Publisher attribution, migrated from the Studio publishers vocabulary.
     */
    publisher: String,
    /**
     * Subject classifications.
     */
    subjects: {
      type: [String],
      default: [],
      index: true,
    },
    /**
     * Free-form tags.
     */
    tags: {
      type: [String],
      default: [],
    },
    /**
     * Keys of screenshot images in object storage.
     */
    screenshots: {
      type: [String],
      default: [],
    },
    /**
     * Indicates which users can view the activity on Commons.
     */
    visibility: {
      type: String,
      enum: ACTIVITY_VISIBILITY_SETTINGS,
      default: "public",
      index: true,
    },
    /**
     * Whether the activity is listed in the public catalog. Studio defaulted this
     * on, and the migration preserves whatever each node carried.
     */
    includeInLibrary: {
      type: Boolean,
      default: true,
    },
    /**
     * Whether the activity is listed on its owner's public profile.
     */
    includeInProfile: {
      type: Boolean,
      default: true,
    },
    /**
     * License information for the activity.
     */
    license: {
      name: String,
      url: String,
      version: String,
      sourceURL: String,
      modifiedFromSource: Boolean,
      additionalTerms: String,
    },
    /**
     * Whether this record describes real production data or a pseudonymised
     * copy made for a non-production environment.
     *
     * Stamped at write time rather than inferred later, so "is this dev data?"
     * is a query and not a judgement call. The default keys off `APP_ENV`:
     * anything created outside production is synthetic by definition. The
     * Studio importer sets it explicitly and refuses to write synthetic
     * records to production or real identities anywhere else.
     */
    dataClass: {
      type: String,
      enum: ACTIVITY_DATA_CLASSES,
      required: true,
      index: true,
      default: () =>
        (process.env.APP_ENV ?? "production") === "production"
          ? "production"
          : "synthetic",
    },
    /**
     * Drupal node id this activity was migrated from.
     *
     * Retained so the legacy `/h5p/{nid}` and inbound Studio links can be
     * resolved to a redirect after cutover. Not set for activities created in
     * Conductor.
     */
    legacyNodeID: {
      type: Number,
      index: true,
    },
    /**
     * Drupal uuid of the migrated node, which Studio's `/api/h5p/{id}` emitted
     * as `uuid`. Kept so the replacement endpoint can return the same value.
     */
    legacyNodeUUID: String,
    /**
     * Studio's integer `h5p_libraries.library_id`, which its API emitted as
     * `type_id` and ADAPT reads. Studio-internal and meaningless elsewhere, so
     * it is not set for activities created in Conductor.
     */
    legacyLibraryID: Number,
    /**
     * Set when an activity is created in Conductor, cleared by its first H5P
     * save. Until then the activity has a content id but no content. A daily
     * job deletes activities still pending after a day: someone opened New
     * H5P and never saved. Never set on migrated activities.
     */
    pendingFirstSave: {
      type: Boolean,
      index: { sparse: true },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Backs the default catalog listing: public, listable activities for this
 * instance's organization, newest first.
 */
ActivitySchema.index({ orgID: 1, visibility: 1, includeInLibrary: 1, updatedAt: -1 });

const Activity = model<ActivityInterface>("Activity", ActivitySchema);

export default Activity;
