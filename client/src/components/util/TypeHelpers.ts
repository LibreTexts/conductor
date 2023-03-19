import { Collection, CollectionResource, Book } from "../../types";

export function checkIsCollection(obj: any): obj is Collection {
  return "collID" in obj;
}

export function checkIsCollectionResource(obj: any): obj is CollectionResource {
  return "resourceType" in obj;
}

export function checkIsBook(obj: any): obj is Book {
  return "bookID" in obj;
}
