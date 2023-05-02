import { Collection, CollectionResource, Book, User } from "../../types";

export function checkIsCollection(obj: any): obj is Collection {
  return "collID" in obj;
}

export function checkIsCollectionResource(obj: any): obj is CollectionResource {
  return "resourceType" in obj;
}

export function checkIsBook(obj: any): obj is Book {
  return "bookID" in obj;
}

export function checkIsUser(obj: any): obj is User {
  return "uuid" in obj
}
