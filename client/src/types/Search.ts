import { Book } from "./Book";
import { Homework } from "./Homework";
import {
  Project,
  ProjectFileWCustomData,
  ProjectFileWProjectData,
} from "./Project";
import { User } from "./User";

export type AssetFilters = {
  license?: string;
  licenseVersion?: string;
  org?: string;
  fileType?: string;
};

export type BookFilters = {
  library?: string;
  subject?: string;
  location?: string;
  license?: string;
  author?: string;
  course?: string;
  affiliation?: string;
};

type _commonSearchParams = {
  searchQuery?: string;
  page?: number;
  limit?: number;
};

export type AssetSearchParams = {
  license?: string;
  licenseVersion?: string;
  org?: string;
  fileType?: string;
} & _commonSearchParams;

export type BookSearchParams = {
  sort?: "title" | "author" | "library" | "subject" | "affiliation";
} & _commonSearchParams &
  BookFilters;

export type HomeworkSearchParams = {
  sort?: "name" | "description";
} & _commonSearchParams;

export type ProjectSearchParams = {
  location?: "local" | "global";
  status?: string;
  visibility?: "public" | "private";
  sort?: "title" | "progress" | "classification" | "visibility" | "updated";
} & _commonSearchParams;

export type UserSearchParams = {
  sort?: "first" | "last";
} & _commonSearchParams;

export type ConductorSearchResponse<
  T extends "assets" | "books" | "homework" | "projects" | "users"
> = {
  numResults: number;
  // if origin is 'commons', then response is of type CommonsSearchResultsObject
  // if origin is 'conductor', then response is of type ConductorSearchResultsObject
  results: T extends "assets"
    ? ProjectFileWProjectData<"title" | "thumbnail">[]
    : T extends "books"
    ? Book[]
    : T extends "homework"
    ? Homework[]
    : T extends "projects"
    ? Project[]
    : T extends "users"
    ? User[]
    : never;
};

export type AssetFiltersAction =
  | {
      type: keyof AssetFilters | "reset_one";
      payload: string;
    }
  | {
      type: "reset";
    };

export type BookFiltersAction =
  | {
      type: keyof BookFilters | "reset_one";
      payload: string;
    }
  | {
      type: "reset";
    };
