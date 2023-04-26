import { CatalogLocation } from "../types";

export function isCatalogLocation(location: string): location is CatalogLocation {
  return ["central", "campus", "all"].includes(location);
}
