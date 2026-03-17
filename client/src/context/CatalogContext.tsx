import { createContext, useContext } from "react";
import type {
  AssetFilters,
  AuthorFilters,
  Book,
  BookFilters,
  CommonsModule,
  Author,
  ConductorSearchResponseFile,
  Project,
  ProjectFilters,
} from "../types";

/**
 * Entity data structure for each catalog type
 */
interface CatalogEntityData<TData, TFilters> {
  data: TData[];
  total: number;
  loading: boolean;
  hasMore: boolean;
  filters: TFilters;
  setFilter: (type: string, value: string) => void;
  resetFilters: () => void;
  resetOneFilter: (type: string) => void;
  loadMore: () => void;
}

/**
 * Context value provided to all CommonsCatalog child components.
 * Eliminates the need for 26 props to CatalogTabs.
 */
export interface CatalogContextValue {
  // Active tab state
  activeTab: CommonsModule;
  setActiveTab: (tab: CommonsModule) => void;

  // Search query
  searchQuery: string;

  // Books entity
  books: CatalogEntityData<Book, BookFilters>;

  // Assets entity
  assets: CatalogEntityData<ConductorSearchResponseFile, AssetFilters>;

  // Projects entity
  projects: CatalogEntityData<Project, ProjectFilters>;

  // Mini-Repos entity
  miniRepos: CatalogEntityData<Project, ProjectFilters>;

  // Authors entity
  authors: CatalogEntityData<Author, AuthorFilters>;

  // Stop loading trigger (for infinite scroll)
  triggerStopLoading: () => void;
}

/**
 * Context for CommonsCatalog component tree.
 * Provides access to all catalog state without prop drilling.
 */
export const CatalogContext = createContext<CatalogContextValue | null>(null);

/**
 * Hook to access the CatalogContext.
 * Must be used within a CatalogContext.Provider.
 *
 * @throws Error if used outside of CatalogContext.Provider
 * @returns The catalog context value
 *
 * @example
 * const catalog = useCatalog();
 * const books = catalog.books.data;
 * const booksLoading = catalog.books.loading;
 * catalog.books.setFilter('author', 'John Doe');
 */
export const useCatalog = (): CatalogContextValue => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalog must be used within CatalogContext.Provider");
  }
  return context;
};
