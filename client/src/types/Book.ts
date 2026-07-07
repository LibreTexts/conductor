import { Prettify } from "./Misc";
import { Project } from "./Project";

export type Book = {
  coverID: string;
  bookID: string;
  title: string;
  author: string;
  affiliation: string;
  library: string;
  subject: string;
  location: string;
  course: string;
  program: string;
  license: string;
  thumbnail: string;
  thumbnailIsAnimated?: boolean;
  summary: string;
  rating: number;
  links: BookLinks;
  lastUpdated: string;
  libraryTags: string[];
  readerResources: ReaderResource[];
  projectID?: string;
  hasReaderResources: boolean;
  allowAnonPR: boolean;
  hasPeerReviews: boolean;
  hasAdaptCourse: boolean;
  adaptCourseID?: string;
  publicAssets?: number; // Computed field only added in Commons searches
  instructorAssets?: number; // Computed field only added in Commons searches
  trafficAnalyticsConfigured?: boolean;
};

export type BookWithSourceData = Book & {
  isbns?: Project["isbns"];
  doi?: string;
  sourceOriginalPublicationDate?: Date;
  sourceHarvestDate?: Date;
  sourceLastModifiedDate?: Date;
  sourceLanguage?: string;
};

export type BookLinks = {
  online: string;
  pdf: string;
  buy: string;
  zip: string;
  files: string;
  lms: string;
};

export type BookWithAutoMatched = Book & {
  autoMatched?: boolean;
};

export type ReaderResource = {
  name: string;
  url: string;
};

export type TableOfContents = {
  id: string;
  title: string;
  url: string;
  children: TableOfContents[];
};

export type RestackerTocLicense = {
  label: string;
  raw: string;
  version?: string;
};

export type RestackerTocEntry = {
  id: string;
  title: string;
  url: string;
  bookLicense?: RestackerTocLicense;
  pageLicense?: RestackerTocLicense;
  sourceLicense?: RestackerTocLicense;
  contentLicenses?: RestackerTocLicense[];
  quotation?: number;
  children: RestackerTocEntry[];
};

export type RestackerEntry = {
  id: string;
  license?: RestackerTocLicense;
  contentLicense: RestackerTocLicense[];
  sourceLicense?: RestackerTocLicense;
  status: "pending" | "running" | "completed" | "failed";
  quotation?: number;
};

export type PageTag = {
  "@value": string;
  "@id": string;
  "@href": string;
  title: string;
  type: string;
  uri: string;
};

export type PageDetailsResponse = {
  overview: string;
  tags: PageTag[];
};

type _PageSimple = {
  id: string;
  title: string;
  url: string;
};

export type PageSimpleWTags = Prettify<
  _PageSimple & {
    tags: PageTag[];
  }
>;

export type PageSimpleWOverview = Prettify<
  _PageSimple & {
    overview: string;
  }
>;

export type TableOfContentsDetailed = Prettify<
  Omit<TableOfContents, "children"> & {
    overview: string;
    tags: string[];
    children: TableOfContentsDetailed[];
  }
>;

export type MasterCatalogV2Response = {
  libraries: {
    library: string;
    courses: {
      course: string;
      books: Book[];
    }[];
    subjects: {
      subject: string;
      books: Book[];
    }[];
  }[];
};

export type BooksManagerSortOptions =
  | "title_asc"
  | "title_desc"
  | "author_asc"
  | "author_desc"
  | "book_id_asc"
  | "book_id_desc"
  | "library_asc"
  | "library_desc";
