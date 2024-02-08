import { model, Schema, Document } from "mongoose";
import Resource, { ResourceInterface } from "../models/resource.js";

export interface CollectionInterface extends Document {
  orgID: string;
  collID: string;
  title: string;
  coverPhoto: string;
  privacy: "public" | "private" | "campus";
  resources?: ResourceInterface[];
  program: string;
  locations: ("central" | "campus")[];
  autoManage: boolean;
  parentID: string;
}

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
      // allow the system to automatically manage the collection based on 'program' and 'locations'
      type: Boolean,
      default: false,
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
