import { useLocation } from "react-router-dom";
import useURLSyncedState from "../useURLSyncedState";
import {
  DEFAULTS,
  SORT_OPTIONS,
  type ProjectSort,
  type BookSort,
  type HomeworkSort,
  type UserSort,
} from "../../screens/conductor/Search/searchConstants";

/**
 * Hook to manage all search parameters with URL synchronization.
 *
 * Returns search query (read-only here) and state objects for each search type
 * containing page, limit, sort, and their setters.
 */
export const useSearchParams = () => {
  const location = useLocation();

  const searchQuery =
    new URLSearchParams(location.search).get("query") || "";

  // Projects
  const [projectsPage, setProjectsPage] = useURLSyncedState(
    "projectsPage",
    String(DEFAULTS.page),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [projectsLimit, setProjectsLimit] = useURLSyncedState(
    "projectsLimit",
    String(DEFAULTS.limit),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [projectsSort, setProjectsSort] = useURLSyncedState(
    "projectsSort",
    DEFAULTS.sort.projects as string,
    SORT_OPTIONS.projects.map((opt) => opt.value) as string[]
  );

  // Books
  const [booksPage, setBooksPage] = useURLSyncedState(
    "booksPage",
    String(DEFAULTS.page),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [booksLimit, setBooksLimit] = useURLSyncedState(
    "booksLimit",
    String(DEFAULTS.limit),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [booksSort, setBooksSort] = useURLSyncedState(
    "booksSort",
    DEFAULTS.sort.books as string,
    SORT_OPTIONS.books.map((opt) => opt.value) as string[]
  );

  // Assets
  const [assetsPage, setAssetsPage] = useURLSyncedState(
    "assetsPage",
    String(DEFAULTS.page),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [assetsLimit, setAssetsLimit] = useURLSyncedState(
    "assetsLimit",
    String(DEFAULTS.limit),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );

  // Homework
  const [homeworkPage, setHomeworkPage] = useURLSyncedState(
    "homeworkPage",
    String(DEFAULTS.page),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [homeworkLimit, setHomeworkLimit] = useURLSyncedState(
    "homeworkLimit",
    String(DEFAULTS.limit),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [homeworkSort, setHomeworkSort] = useURLSyncedState(
    "homeworkSort",
    DEFAULTS.sort.homework as string,
    SORT_OPTIONS.homework.map((opt) => opt.value) as string[]
  );

  // Users
  const [usersPage, setUsersPage] = useURLSyncedState(
    "usersPage",
    String(DEFAULTS.page),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [usersLimit, setUsersLimit] = useURLSyncedState(
    "usersLimit",
    String(DEFAULTS.limit),
    undefined,
    (value): value is string => {
      const num = parseInt(value || "");
      return !isNaN(num) && num > 0;
    }
  );
  const [usersSort, setUsersSort] = useURLSyncedState(
    "usersSort",
    DEFAULTS.sort.users as string,
    SORT_OPTIONS.users.map((opt) => opt.value) as string[]
  );

  return {
    searchQuery,
    projects: {
      page: parseInt(projectsPage) || DEFAULTS.page,
      setPage: (page: number) => setProjectsPage(String(page)),
      limit: parseInt(projectsLimit) || DEFAULTS.limit,
      setLimit: (limit: number) => setProjectsLimit(String(limit)),
      sort: projectsSort as ProjectSort,
      setSort: (value: ProjectSort) => setProjectsSort(value as string),
    },
    books: {
      page: parseInt(booksPage) || DEFAULTS.page,
      setPage: (page: number) => setBooksPage(String(page)),
      limit: parseInt(booksLimit) || DEFAULTS.limit,
      setLimit: (limit: number) => setBooksLimit(String(limit)),
      sort: booksSort as BookSort,
      setSort: (value: BookSort) => setBooksSort(value as string),
    },
    assets: {
      page: parseInt(assetsPage) || DEFAULTS.page,
      setPage: (page: number) => setAssetsPage(String(page)),
      limit: parseInt(assetsLimit) || DEFAULTS.limit,
      setLimit: (limit: number) => setAssetsLimit(String(limit)),
    },
    homework: {
      page: parseInt(homeworkPage) || DEFAULTS.page,
      setPage: (page: number) => setHomeworkPage(String(page)),
      limit: parseInt(homeworkLimit) || DEFAULTS.limit,
      setLimit: (limit: number) => setHomeworkLimit(String(limit)),
      sort: homeworkSort as HomeworkSort,
      setSort: (value: HomeworkSort) => setHomeworkSort(value as string),
    },
    users: {
      page: parseInt(usersPage) || DEFAULTS.page,
      setPage: (page: number) => setUsersPage(String(page)),
      limit: parseInt(usersLimit) || DEFAULTS.limit,
      setLimit: (limit: number) => setUsersLimit(String(limit)),
      sort: usersSort as UserSort,
      setSort: (value: UserSort) => setUsersSort(value as string),
    },
  };
};
