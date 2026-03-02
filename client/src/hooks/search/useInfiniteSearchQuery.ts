import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import api from "../../api";
import useGlobalError from "../../components/error/ErrorHooks";
import type {
  ConductorSearchResponse,
  ProjectSearchParams,
  BookSearchParams,
  AssetSearchParams,
  HomeworkSearchParams,
  UserSearchParams,
  AuthorSearchParams,
  MiniRepoSearchParams,
} from "../../types/Search";

type SearchType = "projects" | "books" | "assets" | "homework" | "users" | "authors" | "minirepos";

type SearchResultMap = {
  projects: ConductorSearchResponse<"projects">["results"];
  books: ConductorSearchResponse<"books">["results"];
  assets: ConductorSearchResponse<"assets">["results"];
  homework: ConductorSearchResponse<"homework">["results"];
  users: ConductorSearchResponse<"users">["results"];
  authors: ConductorSearchResponse<"authors">["results"];
  minirepos: ConductorSearchResponse<"minirepos">["results"];
};

type SearchParamsMap = {
  projects: Omit<ProjectSearchParams, "page">;
  books: Omit<BookSearchParams, "page">;
  assets: Omit<AssetSearchParams, "page">;
  homework: Omit<HomeworkSearchParams, "page">;
  users: Omit<UserSearchParams, "page">;
  authors: Omit<AuthorSearchParams, "page">;
  minirepos: Omit<MiniRepoSearchParams, "page">;
};

interface UseInfiniteSearchOptions {
  /**
   * Enable the query (default: true if searchQuery exists OR browseMode is enabled)
   */
  enabled?: boolean;
  /**
   * Enable browse mode - uses search endpoint even with empty query
   * Set to true for authors/miniRepos that don't have dedicated browse endpoints
   */
  browseMode?: boolean;
}

/**
 * React Query infinite scroll hook for CommonsCatalog.
 * Uses useInfiniteQuery to automatically handle page accumulation and caching.
 *
 * @param type - The search type (projects, books, assets, etc.)
 * @param params - Search parameters (excludes page - managed internally)
 * @param options - Optional configuration
 * @returns Flattened data array, total count, loading state, hasMore flag, and fetchNextPage function
 *
 * @example
 * // Search mode (with query or filters)
 * const books = useInfiniteSearchQuery("books", {
 *   searchQuery,
 *   limit: 24,
 *   ...bookFilters.filters,
 * });
 *
 * @example
 * // Browse mode (always enabled, even without query)
 * const authors = useInfiniteSearchQuery("authors", {
 *   searchQuery,
 *   limit: 24,
 *   ...authorFilters.filters,
 * }, { browseMode: true });
 *
 * // Access: books.data, books.total, books.isLoading, books.hasMore, books.fetchNextPage
 */
export const useInfiniteSearchQuery = <T extends SearchType>(
  type: T,
  params: SearchParamsMap[T],
  options?: UseInfiniteSearchOptions
) => {
  const { handleGlobalError } = useGlobalError();

  // Determine if query should be enabled
  const hasQuery = params.searchQuery && params.searchQuery.length > 0;
  const hasFilters = Object.keys(params).some(
    key => !['searchQuery', 'limit', 'sort'].includes(key) && params[key as keyof typeof params]
  );
  const shouldEnable = options?.enabled !== undefined
    ? options.enabled
    : (options?.browseMode || hasQuery || hasFilters);

  // Query key with stable reference
  const queryKey = useMemo(
    () => [type, 'infinite', params] as const,
    [type, params]
  );

  const query = useInfiniteQuery<{
    results: SearchResultMap[T];
    total: number;
  }>({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      let res;

      // Build params with page number
      const searchParams = { ...params, page: pageParam as number };

      switch (type) {
        case "projects":
          res = await api.projectsSearchV2({
            ...searchParams,
            leads: true,
          } as ProjectSearchParams);
          break;
        case "books":
          res = await api.booksSearchV2(searchParams as BookSearchParams);
          break;
        case "assets":
          res = await api.assetsSearch(searchParams as AssetSearchParams);
          break;
        case "homework":
          res = await api.homeworkSearch(searchParams as HomeworkSearchParams);
          break;
        case "users":
          res = await api.usersSearch(searchParams as UserSearchParams);
          break;
        case "authors":
          res = await api.authorsSearch(searchParams as AuthorSearchParams);
          break;
        case "minirepos":
          res = await api.miniReposSearch(searchParams as MiniRepoSearchParams);
          break;
        default:
          throw new Error(`Unknown search type: ${type}`);
      }

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      return {
        results: res.data.results as SearchResultMap[T],
        total: res.data.numResults || 0,
      };
    },
    enabled: shouldEnable,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.results) return undefined;
      // Calculate total items fetched across all pages
      const currentTotal = allPages.reduce((sum, page) => sum + (page.results?.length || 0), 0);
      // If we have more items to fetch, return the next page number
      return currentTotal < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  // Handle errors globally
  useEffect(() => {
    if (query.isError) {
      handleGlobalError(query.error);
    }
  }, [query.isError, query.error, handleGlobalError]);

  // Flatten pages for backward compatibility with current component structure
  const flattenedData = useMemo(
    (): SearchResultMap[T] => {
      if (!query.data?.pages) return [] as SearchResultMap[T];
      const flattened: any[] = [];
      query.data.pages.forEach(page => {
        if (page.results) {
          flattened.push(...page.results);
        }
      });
      return flattened as SearchResultMap[T];
    },
    [query.data]
  );

  const total = useMemo(
    () => query.data?.pages[0]?.total ?? 0,
    [query.data]
  );

  return useMemo(() => ({
    data: flattenedData,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
  }), [flattenedData, total, query.isLoading, query.isFetching, query.isError, query.error, query.hasNextPage, query.fetchNextPage]);
};
