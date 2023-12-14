import { Book } from "./Book";
import { Homework } from "./Homework";
import { Project, ProjectFileWProjectID } from "./Project";
import { User } from "./User";

export type AssetFilters = {
  assetLicense?: string;
  assetLicenseVersion?: string;
  assetOrg?: string;
  assetFileType?: string;
};

export type BookFilters = {
  bookLibrary?: string;
  bookSubject?: string;
  bookLocation?: string;
  bookLicense?: string;
  bookAuthor?: string;
  bookCourse?: string;
  bookPublisher?: string;
  bookAffiliation?: string;
  bookCID?: string;
};

export type ConductorSearchResultsObject = {
  origin: "conductor";
  projects: Project[];
  books: Book[];
  files: ProjectFileWProjectID[];
  homework: Homework[];
  users: User[];
};

export type CommonsSearchResultsObject = {
  origin: "commons";
  projects: Project[];
  books: Book[];
  files: ProjectFileWProjectID[];
  homework: Homework[];
};

export type ConductorSearchResponse<T extends 'commons' | 'conductor'> = {
  numResults: number;
  // if origin is 'commons', then response is of type CommonsSearchResultsObject
  // if origin is 'conductor', then response is of type ConductorSearchResultsObject
  results: T extends 'commons' ? CommonsSearchResultsObject : ConductorSearchResultsObject;
};