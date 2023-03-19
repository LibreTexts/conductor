import { CollectionLocations, CollectionPrivacyOptions, CollectionResource, CollectionResourceType, GenericKeyTextValueObj } from "../../types";

export const DEFAULT_COLL_LOCS = <CollectionLocations[]>[
  CollectionLocations.CAMPUS,
  CollectionLocations.CENTRAL,
];

export const collectionSortOptions: GenericKeyTextValueObj<string>[] = [
  { key: "title", text: "Sort by Title", value: "title" },
  {
    key: "resources",
    text: "Sort by Number of Resources",
    value: "resources",
  },
];

export const collectionPrivacyOptions: GenericKeyTextValueObj<CollectionPrivacyOptions>[] = [
  { key: "public", text: "Public", value: CollectionPrivacyOptions.PUBLIC },
  { key: "private", text: "Private", value: CollectionPrivacyOptions.PRIVATE },
  { key: "campus", text: "Campus", value: CollectionPrivacyOptions.CAMPUS },
];
