import { Author } from "./Author";
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
  person?: string;
};

export type AuthorFilters = {
  primaryInstitution?: string;
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

export type ProjectFilters = {
  status?: string;
};

export type CustomFilter = {
  title: string;
  options: string[];
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
  person?: string;
  customFilters?: { key: string; value: string }[];
} & _commonSearchParams;

export type AuthorSearchParams = {
  sort?: "first" | "last";
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
  leads?: boolean;
  sort?: "title" | "progress" | "classification" | "visibility" | "updated";
} & _commonSearchParams;

export type UserSearchParams = {
  sort?: "first" | "last";
} & _commonSearchParams;

export type ConductorSearchResponseAuthor = Author & {
  projects: Pick<Project, "projectID" | "title">[];
};
export type ConductorSearchResponseFile = ProjectFileWProjectData<
  "title" | "thumbnail" | "description" | "projectURL"
>;

export type ConductorSearchResponse<
  T extends "assets" | "books" | "homework" | "projects" | "users" | "authors"
> = {
  numResults: number;
  // if origin is 'commons', then response is of type CommonsSearchResultsObject
  // if origin is 'conductor', then response is of type ConductorSearchResultsObject
  results: T extends "assets"
    ? ConductorSearchResponseFile[]
    : T extends "books"
    ? Book[]
    : T extends "homework"
    ? Homework[]
    : T extends "projects"
    ? Project[]
    : T extends "users"
    ? User[]
    : T extends "authors"
    ? ConductorSearchResponseAuthor[]
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

export type AuthorFiltersAction =
  | {
      type: keyof AuthorFilters | "reset_one";
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

export type ProjectFiltersAction =
  | {
      type: keyof ProjectFilters | "reset_one";
      payload: string
    }
  | {
      type: "reset"
    };