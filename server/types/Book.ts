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

export type PageFile = {
  "@id": string;
  "@revision": string;
  "@res-id": string;
  "@href": string;
  "@res-is-head": string;
  "@res-is-deleted": string;
  "@res-rev-is-deleted": string;
  "@res-contents-id": string;
  "alt-text": string;
  contents: {
    "@type": string;
    "@size": string;
    "@width": string;
    "@height": string;
    "@href": string;
  };
  "contents.preview": {
    "@rel": string;
    "@type": string;
    "@maxwidth": string;
    "@maxheight": string;
    "@href": string;
  }[];
  "date.created": string;
  "date.last-modified": string;
  description: string;
  filename: string;
  "page.parent": {
    "@id": string;
    "@guid": string;
    "@draft.state": string;
    "@href": string;
    "@deleted": string;
    "date.created": string;
    language: string;
    namespace: string;
    path: {
      "@seo": string;
      "@type": string;
      "#text": string;
    };
    title: string;
    "uri.ui": string;
  };
  revisions: {
    "@count": string;
    "@totalcount": string;
    "@href": string;
  };
  "user.createdby": {
    "@anonymous": string;
    "@virtual": string;
    "@id": string;
    "@wikiid": string;
    "@href": string;
    "@guid": string;
    "date.created": string;
    "date.lastlogin": string;
    email: string;
    fullname: string;
    "hash.email": string;
    "license.seat": string;
    nick: string;
    password: {
      "@exists": string;
    };
    status: string;
    "uri.avatar": string;
    "uri.gravatar": string;
    username: string;
  };
};

export type PageImagesRes = {
  "@count": string;
  "@offset": string;
  "@totalcount": string;
  "@href": string;
  file: PageFile | PageFile[];
};

export type _generatePageImagesAltTextResObj = {
  fileID: string;
  src: string;
  altText: string;
  error?: string;
};
