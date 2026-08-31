import {
  Collection,
  CollectionLocations,
  CollectionPrivacyOptions,
  CollectionResource,
  GenericKeyTextValueObj,
} from "../../types";
import { isBook } from "../../utils/typeHelpers";
import { withStableKeys } from "../../utils/misc";
import {
  checkIsCollection,
  checkIsCollectionResource,
} from "./TypeHelpers";

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

/**
 * Builds the in-app link for a nested collection, or undefined for leaf
 * resources (which link via getCollectionHref instead).
 *
 * @param item - The collection or collection resource being rendered.
 * @param pathname - The current location pathname to nest beneath.
 */
export const getToLink = (
  item: Collection | CollectionResource,
  pathname: string
): string | undefined => {
  // checkIsCollection tolerates a missing resourceData; the `in` probe below
  // still needs item itself to be an object.
  if (!item || typeof item !== "object") return undefined;
  if ("resourceData" in item && checkIsCollection(item.resourceData)) {
    return (
      (pathname.endsWith("/") ? pathname : `${pathname}/`) +
      encodeURIComponent(item.resourceData.title)
    );
  }
  return undefined;
};

export const getCollectionHref = (item: Collection | CollectionResource) => {
  const data = "resourceData" in item ? item.resourceData : item;
  // A resource whose parent record is gone has no resourceData; fall back to
  // the collections root rather than throwing on the property access below.
  if (!data) return "/collections";
  const book = isBook(data);
  if (book) {
    return `/book/${data.bookID}`;
  } else {
    return `/collections/${encodeURIComponent(data.title)}`;
  }
};

/**
 * Resolves the server-side identifier for a collection grid item.
 *
 * @param item - The collection or collection resource to identify.
 * @returns A namespaced identifier, or null if the item can't be identified.
 */
function getCollectionItemID(item: Collection | CollectionResource): string | null {
  if (checkIsCollection(item)) return `collection-${item.collID}`;
  if (checkIsCollectionResource(item)) return `resource-${item.resourceID}`;
  return null;
}

/**
 * Pairs each collection grid item with a stable React key.
 *
 * @param items - Collections and collection resources in render order.
 * @returns The items paired with unique, render-stable keys.
 */
export function keyCollectionItems<T extends Collection | CollectionResource>(
  items: T[]
): { item: T; key: string }[] {
  return withStableKeys(items, getCollectionItemID);
}
