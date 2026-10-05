import { model, Schema, Document } from "mongoose";
import Resource, { ResourceInterface } from "../models/resource.js";

/**
 * How an auto-managed Collection decides which Books belong to it.
 *
 * Exactly one mode is active per Collection. The modes are deliberately not
 * combinable: an admin reading a collection's config should be able to answer
 * "why is this book here?" from a single rule.
 *
 * `program` is retained for the Collections that already use it and is no longer
 * offered to new ones — see the validators, which accept `shelves` only. The sync
 * still honors it so those Collections keep filling while they are migrated off.
 */
export type CollectionSyncMode = "program" | "shelves";

/** A library shelf an auto-managed Collection draws from. */
export interface CollectionShelfInterface {
  /** Library subdomain, e.g. `chem`. */
  library: string;
  /** Library-relative, decoded path, e.g. `Bookshelves/Organic_Chemistry`. */
  path: string;
}

export interface CollectionInterface extends Document {
  orgID: string;
  collID: string;
  title: string;
  description: string;
  coverPhoto: string;
  privacy: "public" | "private" | "campus";
  resources?: ResourceInterface[];
  program: string;
  locations: ("central" | "campus")[];
  autoManage: boolean;
  syncMode?: CollectionSyncMode;
  syncShelves: CollectionShelfInterface[];
  parentID: string;
}

const CollectionShelfSchema = new Schema<CollectionShelfInterface>(
  {
    library: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const CollectionSchema = new Schema<CollectionInterface>(
  {
    orgID: {
      // the organization's internal identifier string
      type: String,
      required: true,
      index: true,
    },
    collID: {
      // base62 8-digit identifier
      type: String,
      required: true,
      index: true,
    },
    title: {
      // the collection title/name
      type: String,
      required: true,
    },
    description: {
      // the collection description
      type: String,
      default: "",
    },
    coverPhoto: {
      // the collection's "cover photo"/thumbnail
      type: String,
      default: "",
    },
    privacy: {
      // the collection privacy setting (one of: 'public', 'private', 'campus')
      type: String,
      default: "public",
    },
    resources: [Resource.schema], // the array of resource IDs included in the collection, can be either a single resource or a nested collection
    program: {
      // the OER program the collection is automatically managed for
      type: String,
      default: "",
    },
    locations: {
      // locations to search in, if automatically managed (e.g., 'central', 'campus')
      type: [String],
      default: ["central"],
    },
    autoManage: {
      // allow the system to automatically manage the collection's resources during Commons-Libraries syncs
      type: Boolean,
      default: false,
    },
    syncMode: {
      // which rule the sync matches Books on, when automatically managed
      type: String,
      // 'program' is legacy: existing Collections keep it, new ones cannot be
      // created with it.
      enum: ["program", "shelves"],
    },
    syncShelves: {
      // library shelves to draw from, if syncMode is 'shelves'
      type: [CollectionShelfSchema],
      default: [],
    },
    parentID: {
      // collID of the parent collection if collection is nested in another
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Collection = model<CollectionInterface>(
  "Collection",
  CollectionSchema
);

export default Collection;
