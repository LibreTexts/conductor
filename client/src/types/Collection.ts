import { Book } from "./Book";
import collectionLimits from "../../../shared/collection-limits.json";
export type CollectionResource = {
  resourceType: CollectionResourceType;
  resourceID: string;
  resourceData: Book | Collection;
};

export enum CollectionPrivacyOptions {
  PUBLIC = "public",
  PRIVATE = "private",
  CAMPUS = "campus",
}

export enum CollectionLocations {
  CENTRAL = 'central',
  CAMPUS = 'campus'
}

/**
 * How an auto-managed Collection selects its books. Exactly one mode applies per
 * collection; the modes are never combined.
 *
 * `PROGRAM` is legacy. Collections already on it keep syncing, but it cannot be
 * chosen for a new collection or restored on one that has moved to `SHELVES`.
 */
export enum CollectionSyncMode {
  PROGRAM = "program",
  SHELVES = "shelves",
}

/**
 * How many shelves one Collection may sync from.
 *
 * Read from `shared/collection-limits.json`, the same file the server validator
 * reads, so the dialog cannot enforce a different ceiling than the API. Adding a
 * path across every library puts a dozen-plus shelves on a collection at once,
 * so the cap is reachable in a few clicks and has to be enforced before the save
 * rather than reported after it.
 */
export const MAX_COLLECTION_SYNC_SHELVES = collectionLimits.maxSyncShelves;

/** A library shelf an auto-managed Collection draws from. */
export type CollectionShelf = {
  /** Library subdomain, e.g. `chem`. */
  library: string;
  /** Library-relative, decoded path, e.g. `Bookshelves/Organic_Chemistry`. */
  path: string;
};

/** A node in the shelf picker's tree, as the shelves endpoint returns it. */
export type LibraryShelfNode = {
  title: string;
  path: string;
  hasChildren: boolean;
};

export enum CollectionResourceType {
  RESOURCE = "resource",
  COLLECTION = "collection",
}

export type Collection = {
  orgID: string;
  collID: string;
  parentID?: string;
  title: string;
  description: string;
  coverPhoto: string;
  privacy: CollectionPrivacyOptions;
  resources: CollectionResource[];
  program: string;
  locations: string[];
  autoManage: boolean;
  syncMode?: CollectionSyncMode;
  syncShelves: CollectionShelf[];
  resourceCount?: number;
};

/**
 * Used for generating Breadcumb nodes in UI
 */
export type CollectionDirectoryPathObj = {
  collID: string;
  name: string
}
