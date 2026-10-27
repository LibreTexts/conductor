import { model, Schema, Document } from "mongoose";
import {
  ACTIVITY_DATA_CLASSES,
  ACTIVITY_VISIBILITY_SETTINGS,
  ActivityDataClass,
  ActivityVisibility,
} from "./activity.js";

/**
 * A titled, ordered group of activities inside an `ActivityCollection`.
 *
 * Studio modelled these as paragraphs on the collection node. ADAPT's bulk
 * importer turns each one into an assignment named after `title`, so both the
 * grouping and the title are load-bearing, not presentational.
 */
export interface ActivitySubCollectionInterface {
  title: string;
  h5pContentIDs: number[];
}

export interface RawActivityCollectionInterface {
  collectionID: string;
  legacyCollectionID?: number;
  orgID: string;
  title: string;
  description?: string;
  oerReference?: string;
  oerReferenceTitle?: string;
  thumbnail?: string;
  authorCentralID?: string;
  createdBy?: string;
  subjects?: string[];
  tags?: string[];
  subCollections: ActivitySubCollectionInterface[];
  visibility: ActivityVisibility;
  includeInLibrary?: boolean;
  dataClass: ActivityDataClass;
}

export interface ActivityCollectionInterface
  extends RawActivityCollectionInterface,
    Document {}

const ActivitySubCollectionSchema = new Schema<ActivitySubCollectionInterface>(
  {
    title: {
      type: String,
      required: true,
    },
    /**
     * Activities in display order, by H5P content id.
     *
     * Studio referenced H5P nodes, not content. The import resolves each node to
     * its content id, which is the identity Conductor and h5p-service share, so a
     * reference to one of the duplicate nodes collapsed by the activity import
     * lands on the canonical activity.
     */
    h5pContentIDs: {
      type: [Number],
      default: [],
    },
  },
  { _id: false }
);

/**
 * An author-curated collection of H5P activities, migrated from Studio.
 *
 * Deliberately separate from `Collection`, which drives Commons programs and
 * shelves and whose resources reference books. These group activities into
 * titled sub-collections and are addressed by ADAPT through Studio's integer
 * collection id, so folding them into `Collection` would put an external
 * contract inside the Commons catalog model.
 *
 * Studio ordered its collections API by node `changed`. The import writes
 * Studio's `created` and `changed` into `createdAt` and `updatedAt` rather than
 * letting Mongoose stamp the import time, so that ordering survives.
 */
const ActivityCollectionSchema = new Schema<ActivityCollectionInterface>(
  {
    /**
     * Unique Conductor-side identifier of the collection.
     */
    collectionID: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Drupal node id of the Studio collection.
     *
     * ADAPT stores this as `cid` and requests `/api/collections/{cid}` with it,
     * so it is a public contract and must never be regenerated. Not set for
     * collections created in Conductor.
     */
    legacyCollectionID: {
      type: Number,
      unique: true,
      sparse: true,
    },
    /**
     * Identifier of the organization the collection belongs to.
     */
    orgID: {
      type: String,
      required: true,
      index: true,
    },
    /**
     * UI-name of the collection.
     */
    title: {
      type: String,
      required: true,
    },
    description: String,
    /**
     * Free-text reference to the OER the collection supports, migrated from
     * Studio's `field_oer_reference`.
     */
    oerReference: String,
    /**
     * Link text for `oerReference`, from Studio's `field_oer_reference_title`.
     * Studio's collection API rendered the pair as a link.
     */
    oerReferenceTitle: String,
    /**
     * Key or URL of the collection's thumbnail image.
     */
    thumbnail: String,
    /**
     * LibreOne UUID of the author. Authoritative, as on `Activity`.
     */
    authorCentralID: {
      type: String,
      index: true,
    },
    /**
     * Conductor-local UUID of the owner, when a local account exists. Nullable
     * for the same reason as `Activity.createdBy`.
     */
    createdBy: {
      type: String,
      index: true,
    },
    subjects: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    /**
     * Ordered sub-collections. Embedded rather than referenced: the largest
     * Studio sub-collection holds 656 activities, well within a document, and a
     * collection is always read whole.
     */
    subCollections: {
      type: [ActivitySubCollectionSchema],
      default: [],
    },
    /**
     * Studio's publication status. Studio's collection list served only
     * published collections that were also included in the library.
     */
    visibility: {
      type: String,
      enum: ACTIVITY_VISIBILITY_SETTINGS,
      default: "public",
      index: true,
    },
    includeInLibrary: {
      type: Boolean,
      default: true,
    },
    /**
     * Real production data or a pseudonymised copy. Same semantics and default
     * as `Activity.dataClass`.
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
  },
  {
    timestamps: true,
  }
);

/**
 * Backs the collection list: listable collections for this instance's
 * organization, most recently changed first.
 */
ActivityCollectionSchema.index({ orgID: 1, visibility: 1, includeInLibrary: 1, updatedAt: -1 });

/**
 * Finds the collections containing a given activity.
 */
ActivityCollectionSchema.index({ "subCollections.h5pContentIDs": 1 });

const ActivityCollection = model<ActivityCollectionInterface>(
  "ActivityCollection",
  ActivityCollectionSchema
);

export default ActivityCollection;
