import { User } from "./User";

export type KBPageEditor = Pick<User, "firstName" | "lastName" | "avatar">;

export type KBPage = {
  uuid: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  url: string;
  parent?: string;
  lastEditedBy: string | KBPageEditor;
  createdAt: string;
  updatedAt: string;
};

export type KBTreeNode = {
  uuid: string;
  title: string;
  status: "draft" | "published";
  children: KBTreeNode[];
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
