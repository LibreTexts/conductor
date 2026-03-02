import { useQuery } from "@tanstack/react-query";
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
  projects: {
    searchQuery: string;
    page: number;
    limit: number;
    sort?: string;
  };
  books: { searchQuery: string; page: number; limit: number; sort?: string };
  assets: { searchQuery: string; page: number; limit: number; [key: string]: any };
  homework: {
    searchQuery: string;
    page: number;
    limit: number;
    sort?: string;
  };
  users: { searchQuery: string; page: number; limit: number; sort?: string };
  authors: { searchQuery: string; page: number; limit: number; sort?: string; [key: string]: any };
  minirepos: { searchQuery: string; page: number; limit: number; [key: string]: any };
};

interface UseSearchOptions {
  /**
   * Override the enabled condition (default: checks if searchQuery exists)
   */
  enabled?: boolean;
}

/**
 * Generic React Query hook for all search types.
 * Used for traditional pagination in the Search component.
 * For infinite scroll, use useInfiniteSearchQuery instead.
 *
 * @param type - The search type (projects, books, assets, homework, users, authors, minirepos)
 * @param params - The search parameters including searchQuery, page, limit, and optional sort
 * @param options - Optional configuration for enabled state
 * @returns Query result with results array and total count
 *
 * @example
 * // Traditional pagination (Search component)
 * const books = useSearch("books", { searchQuery, page, limit, sort });
 */
export const useSearch = <T extends keyof SearchResultMap>(
  type: T,
  params: SearchParamsMap[T],
  options?: UseSearchOptions
) => {
  const { handleGlobalError } = useGlobalError();

  // Query key with useMemo to ensure stability
  const queryKey = useMemo(
    () => ["search", type, params] as const,
    [type, params]
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let res;

      switch (type) {
        case "projects":
          res = await api.projectsSearchV2({
            ...params,
            leads: true,
          } as ProjectSearchParams);
          break;
        case "books":
          res = await api.booksSearchV2(params as BookSearchParams);
          break;
        case "assets":
          res = await api.assetsSearch(params as AssetSearchParams);
          break;
        case "homework":
          res = await api.homeworkSearch(params as HomeworkSearchParams);
          break;
        case "users":
          res = await api.usersSearch(params as UserSearchParams);
          break;
        case "authors":
          res = await api.authorsSearch(params as AuthorSearchParams);
          break;
        case "minirepos":
          res = await api.miniReposSearch(params as MiniRepoSearchParams);
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
    enabled:
      options?.enabled !== undefined
        ? options.enabled
        : !!params.searchQuery && params.searchQuery.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isError) {
      handleGlobalError(query.error);
    }
  }, [query.isError, query.error, handleGlobalError]);

  // Memoize return value to prevent creating new empty arrays on every render
  return useMemo(() => ({
    data: (query.data?.results || []) as SearchResultMap[T],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }), [query.data, query.isLoading, query.isError, query.error]);
};
