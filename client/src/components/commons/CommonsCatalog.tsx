import "./Commons.css";
import { Grid, Segment, Header, Form, Icon, Button } from "semantic-ui-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import {
  AssetFilters,
  AuthorFilters,
  Book,
  BookFilters,
  CommonsModule,
  ConductorSearchResponseFile,
  Project,
  ProjectFilters,
} from "../../types";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { useHistory, useLocation } from "react-router-dom";
import { useSessionStorage } from "usehooks-ts";
import { truncateString } from "../util/HelperFunctions";
import { getDefaultCommonsModule } from "../../utils/misc";
import { useMediaQuery } from "react-responsive";
import useURLSyncedState from "../../hooks/useURLSyncedState";
import { COMMONS_MODULES } from "../../utils/constants";
import { useCatalogFilters } from "../../hooks/search/useCatalogFilters";
import { useInfiniteSearchQuery } from "../../hooks/search/useInfiniteSearchQuery";
import { CatalogContext } from "../../context/CatalogContext";
import { useQueryClient } from "@tanstack/react-query";

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();
  const isTailwindLg = useMediaQuery({ minWidth: 1024 }, undefined);
  const [randomSeed, setRandomSeed] = useSessionStorage<number>("randomSeed", 0);
  const queryClient = useQueryClient();

  const ITEMS_PER_PAGE = 24;

  // Use generic filter hooks instead of 5 separate reducers
  const assetFilters = useCatalogFilters<AssetFilters>();
  const authorFilters = useCatalogFilters<AuthorFilters>();
  const bookFilters = useCatalogFilters<BookFilters>();
  const miniRepoFilters = useCatalogFilters<ProjectFilters>();
  const projectFilters = useCatalogFilters<ProjectFilters>();

  // UI State
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [loadingDisabled, setLoadingDisabled] = useState(false);
  const [searchString, setSearchString] = useState<string>("");
  const [searchStringUI, setSearchStringUI] = useState<string>(""); // For debouncing the search input
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  // Note: activePage removed - React Query's useInfiniteQuery manages pagination internally

  // Browse mode state (for books, assets, projects when no search/filters)
  const [browsePage, setBrowsePage] = useState(1); // Track page for browse mode manually

  const [browseBooks, setBrowseBooks] = useState<Book[]>([]);
  const [browseBooksCount, setBrowseBooksCount] = useState<number>(0);
  const [browseBooksLoading, setBrowseBooksLoading] = useState(false);

  const [browseAssets, setBrowseAssets] = useState<ConductorSearchResponseFile[]>([]);
  const [browseAssetsCount, setBrowseAssetsCount] = useState<number>(0);
  const [browseAssetsLoading, setBrowseAssetsLoading] = useState(false);

  const [browseProjects, setBrowseProjects] = useState<Project[]>([]);
  const [browseProjectsCount, setBrowseProjectsCount] = useState<number>(0);
  const [browseProjectsLoading, setBrowseProjectsLoading] = useState(false);

  // Memoize default tab to prevent recreating setActiveTab on every render
  const defaultTab = useMemo(
    () => getDefaultCommonsModule(org.commonsModules),
    [org.commonsModules]
  );

  const [activeTab, setActiveTab] = useURLSyncedState<CommonsModule>(
    "active_tab",
    defaultTab,
    COMMONS_MODULES as readonly CommonsModule[]
  );

  // Search mode is active when there's an actual search query or filters applied
  // Note: Only check searchString (not searchStringUI) to avoid mode switching before search fires
  // Per-entity search mode flags (determines browse vs search data source)
  const isBooksSearchMode = searchString.length > 0 || bookFilters.hasFilters;
  const isAssetsSearchMode = searchString.length > 0 || assetFilters.hasFilters;
  const isProjectsSearchMode = searchString.length > 0 || projectFilters.hasFilters;
  // Authors and miniRepos always use search mode (no browse endpoints)
  const isAuthorsSearchMode = true;
  const isMiniReposSearchMode = true;

  // Global search mode flag (for UI elements like reset button, mode detection)
  const isSearchMode =
    searchString.length > 0 ||
    assetFilters.hasFilters ||
    bookFilters.hasFilters ||
    authorFilters.hasFilters ||
    projectFilters.hasFilters ||
    miniRepoFilters.hasFilters;

  // Search mode: Use infinite search hooks with React Query's useInfiniteQuery
  // Memoize params to prevent query key instability
  const booksSearchParams = useMemo(
    () => ({
      searchQuery: searchString,
      limit: ITEMS_PER_PAGE,
      ...bookFilters.filters,
    }),
    [searchString, bookFilters.filters]
  );

  const booksSearchOptions = useMemo(
    () => ({ enabled: isSearchMode && (searchString.length > 0 || bookFilters.hasFilters) }),
    [isSearchMode, searchString, bookFilters.hasFilters]
  );

  const booksSearch = useInfiniteSearchQuery("books", booksSearchParams, booksSearchOptions);

  const assetsSearchParams = useMemo(
    () => ({
      searchQuery: searchString,
      limit: ITEMS_PER_PAGE,
      license: assetFilters.filters.license,
      fileType: assetFilters.filters.fileType,
      org: assetFilters.filters.org,
      person: assetFilters.filters.person,
      customFilters: Object.entries(assetFilters.filters)
        .filter(([key]) => !["license", "org", "fileType", "person"].includes(key))
        .map(([key, value]) => ({ key, value })),
    }),
    [searchString, assetFilters.filters]
  );

  const assetsSearchOptions = useMemo(
    () => ({ enabled: isSearchMode && (searchString.length > 0 || assetFilters.hasFilters) }),
    [isSearchMode, searchString, assetFilters.hasFilters]
  );

  const assetsSearch = useInfiniteSearchQuery("assets", assetsSearchParams, assetsSearchOptions);

  const authorsSearchParams = useMemo(
    () => ({
      searchQuery: searchString,
      limit: ITEMS_PER_PAGE,
      ...authorFilters.filters,
    }),
    [searchString, authorFilters.filters]
  );

  const authorsSearch = useInfiniteSearchQuery("authors", authorsSearchParams, { browseMode: true });

  const miniReposSearchParams = useMemo(
    () => ({
      searchQuery: searchString,
      limit: ITEMS_PER_PAGE,
      ...miniRepoFilters.filters,
    }),
    [searchString, miniRepoFilters.filters]
  );

  const miniReposSearch = useInfiniteSearchQuery("minirepos", miniReposSearchParams, { browseMode: true });

  const projectsSearchParams = useMemo(
    () => ({
      searchQuery: searchString,
      limit: ITEMS_PER_PAGE,
      ...projectFilters.filters,
    }),
    [searchString, projectFilters.filters]
  );

  const projectsSearchOptions = useMemo(
    () => ({ enabled: isSearchMode && searchString.length > 0 }),
    [isSearchMode, searchString]
  );

  const projectsSearch = useInfiniteSearchQuery("projects", projectsSearchParams, projectsSearchOptions);

  // Get final data based on per-entity mode flags
  const books = isBooksSearchMode ? booksSearch.data : browseBooks;
  const booksCount = isBooksSearchMode ? booksSearch.total : browseBooksCount;
  const booksLoading = isBooksSearchMode ? booksSearch.isLoading : browseBooksLoading;

  const assets = isAssetsSearchMode ? assetsSearch.data : browseAssets;
  const assetsCount = isAssetsSearchMode ? assetsSearch.total : browseAssetsCount;
  const assetsLoading = isAssetsSearchMode ? assetsSearch.isLoading : browseAssetsLoading;

  const projects = isProjectsSearchMode ? projectsSearch.data : browseProjects;
  const projectsCount = isProjectsSearchMode ? projectsSearch.total : browseProjectsCount;
  const projectsLoading = isProjectsSearchMode ? projectsSearch.isLoading : browseProjectsLoading;

  const authors = authorsSearch.data;
  const authorsCount = authorsSearch.total;
  const authorsLoading = authorsSearch.isLoading;

  const miniRepos = miniReposSearch.data;
  const miniReposCount = miniReposSearch.total;
  const miniReposLoading = miniReposSearch.isLoading;

  // Extract hasMore flags for infinite scroll control
  const booksHasMore = isBooksSearchMode
    ? booksSearch.hasMore
    : browseBooks.length < browseBooksCount;
  const assetsHasMore = isAssetsSearchMode
    ? assetsSearch.hasMore
    : browseAssets.length < browseAssetsCount;
  const projectsHasMore = isProjectsSearchMode
    ? projectsSearch.hasMore
    : browseProjects.length < browseProjectsCount;
  const authorsHasMore = authorsSearch.hasMore;
  const miniReposHasMore = miniReposSearch.hasMore;

  useEffect(() => {
    // Set page title based on the organization
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | Catalog`;
    } else {
      document.title = "LibreCommons | Catalog";
    }
  }, [org.orgID, org.shortName]);

  useEffect(() => {
    // Initialize from URL
    const search = new URLSearchParams(location.search).get("search");
    setSearchString(search ?? "");

    // Load initial browse data only on mount if no search query
    if (!search) {
      const hasFilters =
        assetFilters.hasFilters ||
        bookFilters.hasFilters ||
        authorFilters.hasFilters ||
        projectFilters.hasFilters ||
        miniRepoFilters.hasFilters;

      if (!hasFilters) {
        loadInitialBrowseData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Note: React Query automatically resets pagination when query keys change
  // Since searchString and filters are included in the query keys,
  // no manual invalidation is needed - queries auto-reset on filter/search changes

  // Use refs to store timeout IDs for manual debouncing
  const searchTimeoutRef = useRef<number>();
  const suggestionsTimeoutRef = useRef<number>();

  const setSearchStringDebounced = useCallback((value: string) => {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => {
      setSearchString(value);
    }, 200);
  }, []);

  const getSuggestionsDebounced = useCallback((searchVal: string) => {
    clearTimeout(suggestionsTimeoutRef.current);
    suggestionsTimeoutRef.current = window.setTimeout(() => {
      getSearchSuggestions(searchVal);
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(searchTimeoutRef.current);
      clearTimeout(suggestionsTimeoutRef.current);
    };
  }, []);

  // Sync searchString with URL when URL changes (e.g., from Enter key or Search button)
  useEffect(() => {
    const search = new URLSearchParams(location.search).get("search");
    const urlSearchValue = search ?? "";

    // Only update if different to avoid unnecessary re-renders
    if (urlSearchValue !== searchString) {
      setSearchString(urlSearchValue);
      setSearchStringUI(urlSearchValue); // Keep UI in sync too
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // Only run when URL changes, not when searchString changes (intentional)

  const updateSearchParam = (newSearchString: string) => {
    const search = newSearchString.trim();
    const url = new URL(window.location.href);

    if (search === "") {
      clearSearchParam();
      if (!isSearchMode) {
        loadInitialBrowseData();
      }
      return;
    } else {
      url.searchParams.set("search", search);
      history.push({
        pathname: location.pathname,
        search: url.search,
      });

      // Reset page and filters when a new search is run
      setBrowsePage(1);
      assetFilters.dispatch({ type: "reset", payload: "" });
      authorFilters.dispatch({ type: "reset", payload: "" });
      bookFilters.dispatch({ type: "reset", payload: "" });
      projectFilters.dispatch({ type: "reset", payload: "" });
      miniRepoFilters.dispatch({ type: "reset", payload: "" });
    }
  };

  const clearSearchParam = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("search")) {
      url.searchParams.delete("search");
    }
    history.push({
      pathname: location.pathname,
    });
  };

  const handleResetSearch = () => {
    clearSearchParam();
    setSearchString("");
    setSearchStringUI("");
    assetFilters.dispatch({ type: "reset", payload: "" });
    authorFilters.dispatch({ type: "reset", payload: "" });
    bookFilters.dispatch({ type: "reset", payload: "" });
    projectFilters.dispatch({ type: "reset", payload: "" });
    miniRepoFilters.dispatch({ type: "reset", payload: "" });
    setBrowsePage(1);
    loadInitialBrowseData();
  };

  // Browse mode data loading (only for books, assets, projects)
  async function loadInitialBrowseData() {
    if (loadingDisabled) return;
    try {
      await Promise.all([
        loadCommonsCatalog(true),
        loadPublicAssets(true),
        loadPublicProjects(true),
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  const loadCommonsCatalog = useCallback(async (clear = false, page = browsePage) => {
    try {
      setBrowseBooksLoading(true);
      const res = await api.getCommonsCatalog({
        activePage: page,
        limit: ITEMS_PER_PAGE,
        seed: randomSeed || undefined,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.books)) {
        if (clear) {
          setBrowseBooks(res.data.books);
        } else {
          setBrowseBooks((prev) => [...prev, ...res.data.books]);
        }
      }

      if (typeof res.data.numTotal === "number") {
        setBrowseBooksCount(res.data.numTotal);
      }
      if (typeof res.data.seed === "number") {
        setRandomSeed(res.data.seed);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBrowseBooksLoading(false);
    }
  }, [browsePage, randomSeed, handleGlobalError]);

  const loadPublicAssets = useCallback(async (clear = false, page = browsePage) => {
    try {
      setBrowseAssetsLoading(true);
      const res = await api.getPublicProjectFiles({
        page,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.files)) {
        if (clear) {
          setBrowseAssets(res.data.files);
        } else {
          setBrowseAssets((prev) => [...prev, ...res.data.files]);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setBrowseAssetsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBrowseAssetsLoading(false);
    }
  }, [browsePage, handleGlobalError]);

  const loadPublicProjects = useCallback(async (clear = false, page = browsePage) => {
    try {
      setBrowseProjectsLoading(true);
      const res = await api.getPublicProjects({
        page,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.projects)) {
        if (clear) {
          setBrowseProjects(res.data.projects);
        } else {
          setBrowseProjects((prev) => [...prev, ...res.data.projects]);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setBrowseProjectsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBrowseProjectsLoading(false);
    }
  }, [browsePage, handleGlobalError]);

  async function getSearchSuggestions(searchVal: string) {
    try {
      if (!searchVal || searchVal.length < 2) return;
      const res = await api.getAutoCompleteSuggestions(searchVal);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (Array.isArray(res.data.results)) {
        setSearchSuggestions(res.data.results);
      }
    } catch (err) {
      console.error(err); // Fail silently for suggestions
    }
  }

  const handleLoadMore = useCallback(() => {
    // Simple check: only allow if not already loading and has more data
    let isCurrentlyLoading = false;
    let hasMoreData = false;

    switch (activeTab) {
      case "books":
        isCurrentlyLoading = booksLoading;
        hasMoreData = booksHasMore;
        break;
      case "assets":
        isCurrentlyLoading = assetsLoading;
        hasMoreData = assetsHasMore;
        break;
      case "projects":
        isCurrentlyLoading = projectsLoading;
        hasMoreData = projectsHasMore;
        break;
      case "authors":
        isCurrentlyLoading = authorsLoading;
        hasMoreData = authorsHasMore;
        break;
      case "minirepos":
        isCurrentlyLoading = miniReposLoading;
        hasMoreData = miniReposHasMore;
        break;
    }

    if (isCurrentlyLoading || !hasMoreData) {
      return;
    }

    // In search mode, use React Query's fetchNextPage
    if (isSearchMode) {
      switch (activeTab) {
        case "books":
          if (isBooksSearchMode) booksSearch.fetchNextPage();
          break;
        case "assets":
          if (isAssetsSearchMode) assetsSearch.fetchNextPage();
          break;
        case "projects":
          if (isProjectsSearchMode) projectsSearch.fetchNextPage();
          break;
        case "authors":
          authorsSearch.fetchNextPage();
          break;
        case "minirepos":
          miniReposSearch.fetchNextPage();
          break;
      }
    } else {
      // In browse mode, manually load more with incremented page
      const nextPage = browsePage + 1;
      setBrowsePage(nextPage);

      // Only load data for the active tab
      switch (activeTab) {
        case "books":
          loadCommonsCatalog(false, nextPage);
          break;
        case "assets":
          loadPublicAssets(false, nextPage);
          break;
        case "projects":
          loadPublicProjects(false, nextPage);
          break;
      }
    }
  }, [
    browsePage,
    activeTab,
    isSearchMode,
    isBooksSearchMode,
    isAssetsSearchMode,
    isProjectsSearchMode,
    booksLoading,
    booksHasMore,
    assetsLoading,
    assetsHasMore,
    projectsLoading,
    projectsHasMore,
    authorsLoading,
    authorsHasMore,
    miniReposLoading,
    miniReposHasMore,
    booksSearch,
    assetsSearch,
    projectsSearch,
    authorsSearch,
    miniReposSearch,
    loadCommonsCatalog,
    loadPublicAssets,
    loadPublicProjects,
  ]);

  const handleTabChange = useCallback((newTab: CommonsModule) => {
    setActiveTab(newTab);
    setBrowsePage(1);
  }, [setActiveTab]);

  // Create context value for CatalogContext.Provider
  const contextValue = useMemo(
    () => {
      return {
        activeTab,
        setActiveTab: handleTabChange,
        searchQuery: searchString,
        books: {
          data: books,
          total: booksCount,
          loading: booksLoading,
          hasMore: booksHasMore,
          filters: bookFilters.filters,
          setFilter: (type: string, value: string) =>
            bookFilters.dispatch({ type, payload: value }),
          resetFilters: () => bookFilters.dispatch({ type: "reset", payload: "" }),
          resetOneFilter: (type: string) =>
            bookFilters.dispatch({ type: "reset_one", payload: type }),
          loadMore: handleLoadMore,
        },
        assets: {
          data: assets,
          total: assetsCount,
          loading: assetsLoading,
          hasMore: assetsHasMore,
          filters: assetFilters.filters,
          setFilter: (type: string, value: string) =>
            assetFilters.dispatch({ type, payload: value }),
          resetFilters: () => assetFilters.dispatch({ type: "reset", payload: "" }),
          resetOneFilter: (type: string) =>
            assetFilters.dispatch({ type: "reset_one", payload: type }),
          loadMore: handleLoadMore,
        },
        projects: {
          data: projects,
          total: projectsCount,
          loading: projectsLoading,
          hasMore: projectsHasMore,
          filters: projectFilters.filters,
          setFilter: (type: string, value: string) =>
            projectFilters.dispatch({ type, payload: value }),
          resetFilters: () => projectFilters.dispatch({ type: "reset", payload: "" }),
          resetOneFilter: (type: string) =>
            projectFilters.dispatch({ type: "reset_one", payload: type }),
          loadMore: handleLoadMore,
        },
        miniRepos: {
          data: miniRepos,
          total: miniReposCount,
          loading: miniReposLoading,
          hasMore: miniReposHasMore,
          filters: miniRepoFilters.filters,
          setFilter: (type: string, value: string) =>
            miniRepoFilters.dispatch({ type, payload: value }),
          resetFilters: () =>
            miniRepoFilters.dispatch({ type: "reset", payload: "" }),
          resetOneFilter: (type: string) =>
            miniRepoFilters.dispatch({ type: "reset_one", payload: type }),
          loadMore: handleLoadMore,
        },
        authors: {
          data: authors,
          total: authorsCount,
          loading: authorsLoading,
          hasMore: authorsHasMore,
          filters: authorFilters.filters,
          setFilter: (type: string, value: string) =>
            authorFilters.dispatch({ type, payload: value }),
          resetFilters: () => authorFilters.dispatch({ type: "reset", payload: "" }),
          resetOneFilter: (type: string) =>
            authorFilters.dispatch({ type: "reset_one", payload: type }),
          loadMore: handleLoadMore,
        },
        triggerStopLoading: () => setLoadingDisabled(true),
      };
    },
    [
      activeTab,
      searchString,
      books,
      booksCount,
      booksLoading,
      booksHasMore,
      bookFilters.filters,
      assets,
      assetsCount,
      assetsLoading,
      assetsHasMore,
      assetFilters.filters,
      projects,
      projectsCount,
      projectsLoading,
      projectsHasMore,
      projectFilters.filters,
      miniRepos,
      miniReposCount,
      miniReposLoading,
      miniReposHasMore,
      miniRepoFilters.filters,
      authors,
      authorsCount,
      authorsLoading,
      authorsHasMore,
      authorFilters.filters,
      handleTabChange,
      handleLoadMore,
    ]
  );

  return (
    <CatalogContext.Provider value={contextValue}>
      <Grid className="commons-container">
        <Grid.Row>
          <Grid.Column width={16}>
            <Segment.Group raised>
              {((org.commonsHeader && org.commonsHeader !== "") ||
                (org.commonsMessage && org.commonsMessage !== "")) && (
                  <Segment padded>
                    {org.commonsHeader && org.commonsHeader !== "" && (
                      <Header
                        id="commons-intro-header"
                        as="h2"
                        className="text-center lg:text-left"
                      >
                        {org.commonsHeader}
                      </Header>
                    )}
                    <p
                      id="commons-intro-message"
                      className="text-center lg:text-left"
                    >
                      {org.commonsMessage}
                    </p>
                  </Segment>
                )}
              <Segment>
                <div className="my-8 flex flex-col">
                  <div className="flex flex-row items-center justify-center w-full">
                    <Form
                      onSubmit={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <div className="w-72 lg:w-[68rem]">
                        <Form.Input
                          placeholder="Search..."
                          className="!mb-0 !border-r-none"
                          id="commons-search-input"
                          iconPosition="left"
                          action
                          fluid
                          aria-label="Search query"
                          value={searchStringUI}
                          onChange={(e) => {
                            setSearchStringUI(e.target.value); // Update the UI value immediately
                            setSearchStringDebounced(e.target.value); // Debounce the actual search string update
                            getSuggestionsDebounced(e.target.value);
                            if (e.target.value.length === 0) {
                              setShowSuggestions(false);
                            } else {
                              setShowSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowSuggestions(false); // Delay to allow suggestion click event to fully run
                            }, 200);
                          }}
                          onKeyDown={(e: any) => {
                            if (e.key === "Enter") {
                              e.preventDefault(); // Prevent form submission on Enter key press
                              updateSearchParam(searchStringUI); // Trigger search on Enter key press
                            }
                          }}
                        >
                          <Icon name="search" />
                          <input />
                          <Button
                            color="blue"
                            onClick={() => updateSearchParam(searchStringUI)}
                            className="!m-0 w-10 !p-4 lg:w-auto"
                          >
                            <Icon name="search" />
                            {isTailwindLg && "Search Catalog"}
                          </Button>
                        </Form.Input>
                        {showSuggestions && searchSuggestions.length > 0 && (
                          <div className="py-2 border rounded-md shadow-md">
                            {searchSuggestions.map((suggestion) => {
                              return (
                                <p
                                  className="px-2 hover:bg-slate-50 rounded-md cursor-pointer font-semibold"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    updateSearchParam(suggestion);
                                    setShowSuggestions(false);
                                  }}
                                  key={crypto.randomUUID()}
                                >
                                  {truncateString(suggestion, 100)}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Form>
                  </div>
                  {(searchString || isSearchMode) && (
                    <div className="flex justify-center items-center w-full mt-8">
                      <Button
                        icon
                        labelPosition="left"
                        onClick={handleResetSearch}
                        className="mt-2"
                      >
                        <Icon name="redo" />
                        Reset Search
                      </Button>
                    </div>
                  )}
                </div>
                <CatalogTabs />
              </Segment>
            </Segment.Group>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </CatalogContext.Provider>
  );
};

export default CommonsCatalog;
