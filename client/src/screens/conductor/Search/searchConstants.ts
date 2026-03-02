import type {
  ProjectSearchParams,
  BookSearchParams,
  HomeworkSearchParams,
  UserSearchParams,
} from "../../../types/Search";

export type SearchType = "projects" | "books" | "assets" | "homework" | "users";

export type ProjectSort = ProjectSearchParams["sort"];
export type BookSort = BookSearchParams["sort"];
export type HomeworkSort = HomeworkSearchParams["sort"];
export type UserSort = UserSearchParams["sort"];

export const SORT_OPTIONS = {
  projects: [
    { key: "relevance", text: "Sort by Relevance", value: "relevance" },
    { key: "title", text: "Sort by Title", value: "title" },
    {
      key: "classification",
      text: "Sort by Classification",
      value: "classification",
    },
    { key: "visibility", text: "Sort by Visibility", value: "visibility" },
  ],
  books: [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
    { key: "library", text: "Sort by Library", value: "library" },
    { key: "subject", text: "Sort by Subject", value: "subject" },
    { key: "affiliation", text: "Sort by Affiliation", value: "affiliation" },
  ],
  homework: [
    { key: "name", text: "Sort by Name", value: "name" },
    { key: "description", text: "Sort by Description", value: "description" },
  ],
  users: [
    { key: "first", text: "Sort by First Name", value: "first" },
    { key: "last", text: "Sort by Last Name", value: "last" },
  ],
} as const;

export const DEFAULTS = {
  page: 1,
  limit: 12,
  sort: {
    projects: "relevance" as ProjectSort,
    books: "title" as BookSort,
    homework: "name" as HomeworkSort,
    users: "first" as UserSort,
  },
} as const;
