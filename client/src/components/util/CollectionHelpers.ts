import {
  Collection,
  CollectionLocations,
  CollectionPrivacyOptions,
  CollectionResource,
  GenericKeyTextValueObj,
} from "../../types";
import { isBook } from "../../utils/typeHelpers";

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

export const collectionPrivacyOptions: GenericKeyTextValueObj<CollectionPrivacyOptions>[] =
  [
    { key: "public", text: "Public", value: CollectionPrivacyOptions.PUBLIC },
    {
      key: "private",
      text: "Private",
      value: CollectionPrivacyOptions.PRIVATE,
    },
    { key: "campus", text: "Campus", value: CollectionPrivacyOptions.CAMPUS },
  ];

export const getCollectionHref = (item: Collection | CollectionResource) => {
  const data = "resourceData" in item ? item.resourceData : item;
  const book = isBook(data);
  if (book) {
    return `/book/${data.bookID}`;
  } else {
    return `/collections/${encodeURIComponent(data.title)}`;
  }
};
