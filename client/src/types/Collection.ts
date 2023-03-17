export type CollectionResource = {
  resourceType: CollectionResourceType;
  resourceID: string;
};

export enum CollectionPrivacyOptions {
  PUBLIC = "public",
  PRIVATE = "private",
  CAMPUS = "campus",
}

export enum CollectionResourceType {
  RESOURCE = "resource",
  COLLECTION = "collection",
}

export enum CollectionLocations {
  CENTRAL = "central",
  CAMPUS = "campus",
}

export type Collection = {
  orgID: string;
  collID: string;
  parentID?: string;
  title: string;
  coverPhoto: string;
  privacy: CollectionPrivacyOptions;
  resources: CollectionResource[];
  program: string;
  locations: CollectionLocations;
  autoManage: boolean;
};

/**
 * Used for generating Breadcumb nodes in UI
 */
export type CollectionDirectoryPathObj = {
  collID: string;
  name: string
}
