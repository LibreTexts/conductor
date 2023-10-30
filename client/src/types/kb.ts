import { AtlasSearchHighlight } from "./Misc";
import { User } from "./User";

export type KBPageEditor = Pick<User, "firstName" | "lastName" | "avatar">;

export type KBPage = {
  uuid: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  slug: string;
  parent?: string;
  lastEditedBy: string | KBPageEditor;
  createdAt: string;
  updatedAt: string;
};

export type KBTreeNode = {
  uuid: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  children: KBTreeNode[];
};

export type KBSearchResult = Pick<KBPage, "uuid" | "title" | "description" | "slug" | "status" | "parent"> & {
  highlight: AtlasSearchHighlight[];
};

export type KBFeaturedPage = {
  uuid: string;
  page: KBPage;
}

export type KBFeaturedVideo = {
  uuid: string;
  title: string;
  url: string;
}

export type KBFeaturedContent = {
  pages: KBFeaturedPage[];
  videos: KBFeaturedVideo[];
}
