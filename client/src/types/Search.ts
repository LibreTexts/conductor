import { Book } from "./Book";
import { Homework } from "./Homework";
import { Project, ProjectFileWProjectIDAndTitleAndThumbnail } from "./Project";
import { User } from "./User";

export type AssetFilters = {
  license?: string;
  licenseVersion?: string;
  org?: string;
  fileType?: string;
};

export type BookFilters = {
  bookLibrary?: string;
  bookSubject?: string;
  bookLocation?: string;
  bookLicense?: string;
  bookLicenseVersion?: string;
  bookAuthor?: string;
  bookCourse?: string;
  bookPublisher?: string;
  bookAffiliation?: string;
  bookCID?: string;
};

type _commonSearchParams = {
  strictMode: boolean;
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
  library?: string;
  subject?: string;
  location?: "campus" | "central";
  license?: string;
  author?: string;
  course?: string;
  publisher?: string;
  affiliation?: string;
  CID?: string;
  sort?: "title" | "author" | "library" | "subject" | "affiliation";
} & _commonSearchParams;

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
    ? ProjectFileWProjectIDAndTitleAndThumbnail[]
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
