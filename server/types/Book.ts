import { Prettify } from "./Misc";

export type BookSortOption = "random" | "author" | "title";
export type TableOfContents = {
  id: string;
  title: string;
  url: string;
  children: TableOfContents[];
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

export type PageBase = {
  "@id": string;
  "@guid": string;
  "@draft.state": string;
  "@href": string;
  "@deleted": string;
  "@revision": string;
  article: string;
  "date.created": string;
  "date.modified": string;
  language: string;
  namespace: string;
  path: PagePath;
  security: Record<string, any>;
  title: string;
  "uri.ui": string;
};

export type PagePath = {
  "@seo": string;
  "@type": string;
  "#text": string;
};

export type GetPageSubPagesResponse = {
  page: Omit<PageBase, "article"> & {
    properties: Record<string, any>;
    subpages: {
      page: PageBase | PageBase[];
    };
  };
};

type _PageSimple = {
  id: string;
  title: string;
  url: string;
};

export type PageSimpleWTags = Prettify<
  _PageSimple & {
    tags: string[];
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
