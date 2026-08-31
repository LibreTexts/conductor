import { Collection, CollectionResource, Book, User } from "../../types";

/**
 * The `in` operator throws on null/undefined and on primitives, so every guard
 * below rejects non-objects before probing for its discriminant. Callers pass
 * unvalidated API data — e.g. a CollectionResource whose parent record was
 * deleted arrives with `resourceData: undefined` — and a guard that throws
 * defeats the point of guarding.
 */
const isObject = (obj: any): obj is Record<string, unknown> =>
  !!obj && typeof obj === "object";

export function checkIsCollection(obj: any): obj is Collection {
  return isObject(obj) && "collID" in obj;
}

export function checkIsCollectionResource(obj: any): obj is CollectionResource {
  return isObject(obj) && "resourceType" in obj;
}

export function checkIsBook(obj: any): obj is Book {
  return isObject(obj) && "bookID" in obj;
}

export function checkIsUser(obj: any): obj is User {
  return isObject(obj) && "uuid" in obj;
}
