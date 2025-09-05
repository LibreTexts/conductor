import "./Commons.css";
import { Grid, Segment, Header, Form, Icon, Button } from "semantic-ui-react";
import { useEffect, useState, useReducer } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import useDebounce from "../../hooks/useDebounce";
import {
  AssetFilters,
  AuthorFilters,
  AuthorFiltersAction,
  Book,
  BookFilters,
  BookFiltersAction,
  CommonsModule,
  ConductorSearchResponseAuthor,
  ConductorSearchResponseFile,
  MiniRepoFiltersAction,
  Project,
  ProjectFilters,
  ProjectFiltersAction,
} from "../../types";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { useHistory, useLocation } from "react-router-dom";
import { truncateString } from "../util/HelperFunctions";
import { getDefaultCommonsModule } from "../../utils/misc";
import { useMediaQuery } from "react-responsive";
import useURLSyncedState from "../../hooks/useURLSyncedState";
import { COMMONS_MODULES } from "../../utils/constants";

function assetsReducer(
  state: Record<string, string>,
  action: { type: string; payload: string }
): AssetFilters {
  switch (action.type) {
    case "license":
      return { ...state, license: action.payload };
    case "org":
      return { ...state, org: action.payload };
    case "fileType":
      return { ...state, fileType: action.payload };
    case "person":
      return { ...state, person: action.payload };
    case "reset":
      return {};
    case "reset_one": {
      const newState = { ...state };
      delete newState[action.payload as keyof AssetFilters];
      return newState;
    }
    default:
      return { ...state, [action.type]: action.payload };
  }
}

function authorsReducer(
  state: AuthorFilters,
  action: AuthorFiltersAction
): AuthorFilters {
  switch (action.type) {
    case "primaryInstitution":
      return { ...state, primaryInstitution: action.payload };
    case "reset":
      return {};
    case "reset_one":
      const newState = { ...state };
      delete newState[action.payload as keyof AuthorFilters];
      return newState;
    default:
      return state;
  }
}

function booksReducer(
  state: BookFilters,
  action: BookFiltersAction
): BookFilters {
  switch (action.type) {
    case "author":
      return { ...state, author: action.payload };
    case "library":
      return { ...state, library: action.payload };
    case "subject":
      return { ...state, subject: action.payload };
    case "affiliation":
      return { ...state, affiliation: action.payload };
    case "assets":
      return { ...state, assets: action.payload };
    case "reset":
      return {};
    case "reset_one":
      const newState = { ...state };
      delete newState[action.payload as keyof BookFilters];
      return newState;
    default:
      return state;
  }
}

function miniReposReducer(
  state: ProjectFilters,
  action: MiniRepoFiltersAction
): ProjectFilters {
  switch (action.type) {
    case "status":
      return { ...state, status: action.payload };
    case "reset":
      return {};
    case "reset_one":
      const newState = { ...state };
      delete newState[action.payload as keyof ProjectFilters];
      return newState;
    default:
      return state;
  }
}

function projectsReducer(
  state: ProjectFilters,
  action: ProjectFiltersAction
): ProjectFilters {
  switch (action.type) {
    case "status":
      return { ...state, status: action.payload };
    case "reset":
      return {};
    case "reset_one":
      const newState = { ...state };
      delete newState[action.payload as keyof ProjectFilters];
      return newState;
    default:
      return state;
  }
}

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const isTailwindLg = useMediaQuery(
    { minWidth: 1024 }, // Tailwind LG breakpoint
    undefined
  );
  const ITEMS_PER_PAGE = 24;

  const [assetsState, assetsDispatch] = useReducer(assetsReducer, {});
  const [authorsState, authorsDispatch] = useReducer(authorsReducer, {});
  const [booksState, booksDispatch] = useReducer(booksReducer, {});
  const [miniReposState, miniReposDispatch] = useReducer(miniReposReducer, {});
  const [projectsState, projectsDispatch] = useReducer(projectsReducer, {});

  const [showSuggestions, setShowSuggestions] = useState(true);

  const [loadingDisabled, setLoadingDisabled] = useState(false);

  const [searchString, setSearchString] = useState<string>("");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [activePage, setActivePage] = useState(1);

  const [books, setBooks] = useState<Book[]>([]);
  const [booksCount, setBooksCount] = useState<number>(0);

  const [assets, setAssets] = useState<ConductorSearchResponseFile[]>([]);
  const [assetsCount, setAssetsCount] = useState<number>(0);

  const [miniRepos, setMiniRepos] = useState<Project[]>([]);
  const [miniReposCount, setMiniReposCount] = useState<number>(0);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);

  const [authors, setAuthors] = useState<ConductorSearchResponseAuthor[]>([]);
  const [authorsCount, setAuthorsCount] = useState<number>(0);

  const [booksLoading, setBooksLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [miniReposLoading, setMiniReposLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [authorsLoading, setAuthorsLoading] = useState(false);

  const [activeTab, setActiveTab] = useURLSyncedState<CommonsModule>(
    'active_tab',
    getDefaultCommonsModule(org.commonsModules),
    COMMONS_MODULES as readonly CommonsModule[]
  );

  useEffect(() => {
    // Set page title based on the organization
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | Catalog`;
    } else {
      document.title = "LibreCommons | Catalog";
    }
  }, []);

  useEffect(() => {
    // If there is a search query in the URL, run the search
    const search = new URLSearchParams(location.search).get("search");
    setSearchString(search ?? "");
    runSearch({
      query: search ?? "",
      assetFilters: assetsState,
      bookFilters: booksState,
      authorFilters: authorsState,
      projectFilters: projectsState,
      miniRepoFilters: miniReposState,
    });
  }, [assetsState, booksState, authorsState, miniReposState, projectsState, location.search]);

  const getSuggestionsDebounced = debounce(
    (searchVal: string) => getSearchSuggestions(searchVal),
    150
  );

  const updateSearchParam = (searchString: string) => {
    const search = searchString.trim();
    const url = new URL(window.location.href);

    if (search === "") {
      clearSearchParam();
      if (
        assetFiltersApplied() ||
        bookFiltersApplied() ||
        authorFiltersApplied() ||
        projectFiltersApplied() ||
        miniRepoFiltersApplied()
      ) {
        runSearch({ query: search }); // handle no search query but filters
      } else {
        loadInitialData(true);
      }
      return;
    } else {
      url.searchParams.set("search", search);

      // only need the relative path with query string
      history.push({
        pathname: location.pathname,
        search: url.search,
      });

      // Reset active page when a new search is run
      setActivePage(1);

      // Reset the advanced search filters when a new search is run
      assetsDispatch({ type: "reset", payload: "" });
      authorsDispatch({ type: "reset" });
      booksDispatch({ type: "reset" });
      projectsDispatch({ type: "reset" });
      miniReposDispatch({ type: "reset" });
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
    assetsDispatch({ type: "reset", payload: "" });
    authorsDispatch({ type: "reset" });
    booksDispatch({ type: "reset" });
    projectsDispatch({ type: "reset" });
    miniReposDispatch({ type: "reset" });
    setActivePage(1);
    setBooks([]);
    setAssets([]);
    setProjects([]);
    setMiniRepos([]);
    setAuthors([]);
    loadInitialData(true);
  };

  async function runSearch({
    query,
    assetFilters,
    bookFilters,
    authorFilters,
    projectFilters,
    miniRepoFilters,
  }: {
    query?: string;
    assetFilters?: AssetFilters;
    bookFilters?: BookFilters;
    authorFilters?: AuthorFilters;
    projectFilters?: ProjectFilters;
    miniRepoFilters?: ProjectFilters;
  }) {
    try {
      if (loadingDisabled) return;
      setActivePage(1);

      if (
        !query &&
        (!assetFilters || !Object.keys(assetFilters).length) &&
        (!bookFilters || !Object.keys(bookFilters).length) &&
        (!authorFilters || !Object.keys(authorFilters).length) &&
        (!projectFilters || !Object.keys(projectFilters).length) &&
        (!miniRepoFilters || !Object.keys(miniRepoFilters).length)
      ) {
        return loadInitialData(true);
      }

      await Promise.all([
        handleBooksSearch(query ?? searchString, bookFilters, true),
        handleAssetsSearch(query ?? searchString, assetFilters, true),
        handleMiniReposSearch(query ?? searchString, miniRepoFilters, true),
        handleProjectsSearch(query ?? searchString, projectFilters, true),
        handleAuthorsSearch(query ?? searchString, authorFilters, true),
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function loadInitialData(clear = false) {
    try {
      if (loadingDisabled) return;
      await Promise.all([
        loadCommonsCatalog(clear),
        loadPublicAssets(clear),
        loadPublicProjects(clear),
        handleAuthorsSearch("", {}, clear),
        handleMiniReposSearch("", {}, clear),
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  // Books
  async function loadCommonsCatalog(clear = false, page = activePage) {
    try {
      setBooksLoading(true);
      const res = await api.getCommonsCatalog({
        activePage: page,
        limit: ITEMS_PER_PAGE,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.books)) {
        if (clear) {
          setBooks([...res.data.books]);
        } else {
          setBooks([...books, ...res.data.books]);
        }
      }
      if (typeof res.data.numTotal === "number") {
        setBooksCount(res.data.numTotal);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBooksLoading(false);
    }
  }

  async function handleBooksSearch(
    query?: string,
    bookFilters?: BookFilters,
    clearAndUpdate = false,
    page = activePage
  ) {
    try {
      setBooksLoading(true);
      const res = await api.booksSearch({
        ...(query && { searchQuery: query }),
        page: page,
        limit: ITEMS_PER_PAGE,
        ...bookFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        updateBooks(res.data.results, clearAndUpdate);
      }

      if (typeof res.data.numResults === "number") {
        setBooksCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBooksLoading(false);
    }
  }

  // Assets
  async function loadPublicAssets(clear = false) {
    try {
      setAssetsLoading(true);
      const res = await api.getPublicProjectFiles({
        page: activePage,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.files)) {
        if (clear) {
          setAssets(res.data.files);
        } else {
          updateAssets(res.data.files, false);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setAssetsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAssetsLoading(false);
    }
  }

  async function handleAssetsSearch(
    query?: string,
    assetFilters?: Record<string, string>,
    clearAndUpdate = false,
    page = activePage
  ) {
    try {
      setAssetsLoading(true);

      const customFiltersApplied = Object.entries(assetFilters ?? {})
        .filter(
          ([key, value]) =>
            !["license", "org", "fileType", "person"].includes(key)
        )
        .map(([key, value]) => ({ key, value }));

      const res = await api.assetsSearch({
        ...(query && { searchQuery: query }),
        page,
        limit: ITEMS_PER_PAGE,
        license: assetFilters?.license,
        fileType: assetFilters?.fileType,
        org: assetFilters?.org,
        person: assetFilters?.person,
        customFilters: customFiltersApplied,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        updateAssets(res.data.results, clearAndUpdate);
      }
      if (typeof res.data.numResults === "number") {
        setAssetsCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAssetsLoading(false);
    }
  }

  // Authors
  async function handleAuthorsSearch(
    query: string,
    authorFilters?: AuthorFilters,
    clearAndUpdate = false,
    page = activePage
  ) {
    try {
      setAuthorsLoading(true);
      const res = await api.authorsSearch({
        page,
        limit: ITEMS_PER_PAGE,
        ...(query && { searchQuery: query }),
        ...authorFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results || !Array.isArray(res.data.results)) {
        throw new Error("No results found.");
      }

      updateAuthors(res.data.results, clearAndUpdate);

      if (typeof res.data.numResults === "number") {
        setAuthorsCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAuthorsLoading(false);
    }
  }

  // Mini-Repos
  async function handleMiniReposSearch(
    query?: string,
    miniRepoFilters?: ProjectFilters,
    clearAndUpdate = false,
    page = activePage
  ) {
    try {
      setMiniReposLoading(true);
      const res = await api.miniReposSearch({
        page,
        limit: ITEMS_PER_PAGE,
        ...(query && { searchQuery: query }),
        ...miniRepoFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results || !Array.isArray(res.data.results)) {
        throw new Error("No results found.");
      }

      updateMiniRepos(res.data.results, clearAndUpdate);

      if (typeof res.data.numResults === "number") {
        setMiniReposCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setMiniReposLoading(false);
    }
  }

  // Projects
  async function loadPublicProjects(clear = false) {
    try {
      setProjectsLoading(true);
      const res = await api.getPublicProjects({
        page: activePage,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.projects)) {
        if (clear) {
          setProjects(res.data.projects);
        } else {
          setProjects([...projects, ...res.data.projects]);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setProjectsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function handleProjectsSearch(
    query?: string,
    projectFilters?: ProjectFilters,
    clearAndUpdate = false,
    page = activePage
  ) {
    try {
      setProjectsLoading(true);
      const res = await api.projectsSearch({
        searchQuery: query,
        page,
        limit: ITEMS_PER_PAGE,
        ...projectFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results || !Array.isArray(res.data.results)) {
        throw new Error("No results found.");
      }

      updateProjects(res.data.results, clearAndUpdate);

      if (typeof res.data.numResults === "number") {
        setProjectsCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setProjectsLoading(false);
    }
  }

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
      console.error(err); // Fail silently
    }
  }

  const authorFiltersApplied = (): boolean => {
    return Object.keys(authorsState).length > 0;
  };

  const bookFiltersApplied = (): boolean => {
    return Object.keys(booksState).length > 0;
  };

  const assetFiltersApplied = (): boolean => {
    return Object.keys(assetsState).length > 0;
  };

  const miniRepoFiltersApplied = (): boolean => {
    return Object.keys(miniReposState).length > 0;
  };

  const projectFiltersApplied = (): boolean => {
    return Object.keys(projectsState).length > 0;
  };

  function handleLoadMoreBooks() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    if (searchString || bookFiltersApplied()) {
      return handleBooksSearch(searchString, booksState, false, nextPage);
    } else {
      return loadCommonsCatalog(false, nextPage);
    }
  }

  function handleLoadMoreAssets() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    if (searchString || assetFiltersApplied()) {
      return handleAssetsSearch(searchString, assetsState, false, nextPage);
    } else {
      return loadPublicAssets();
    }
  }

  function handleLoadMoreMiniRepos() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    return handleMiniReposSearch(searchString, miniReposState, false, nextPage);
  }

  function handleLoadMoreProjects() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    if (searchString) {
      return handleProjectsSearch(searchString, projectsState, false, nextPage);
    } else {
      return loadPublicProjects();
    }
  }

  function handleLoadMoreAuthors() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    return handleAuthorsSearch(searchString, authorsState, false, nextPage);
  }

  /**
   * This is a workaround to handle cases where we want to clear the existing state,
   * but React doesn't update the state immediately/recognize the change.
   * This helps us distinguish between the case where a new search was ran and no results were found,
   * and the case where we are just loading more results, and don't want to clear the existing state.
   */
  function updateAssets(
    newAssets: ConductorSearchResponseFile[],
    clearAndUpdate = false
  ) {
    if (clearAndUpdate) {
      setAssets([...newAssets]);
    } else {
      setAssets([...assets, ...newAssets]);
    }
  }

  function updateBooks(newBooks: Book[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setBooks([...newBooks]);
    } else {
      setBooks([...books, ...newBooks]);
    }
  }

  function updateMiniRepos(newMiniRepos: Project[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setMiniRepos([...newMiniRepos]);
    } else {
      setMiniRepos([...miniRepos, ...newMiniRepos]);
    }
  }

  function updateProjects(newProjects: Project[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setProjects([...newProjects]);
    } else {
      setProjects([...projects, ...newProjects]);
    }
  }

  function updateAuthors(
    newAuthors: ConductorSearchResponseAuthor[],
    clearAndUpdate = false
  ) {
    if (clearAndUpdate) {
      setAuthors([...newAuthors]);
    } else {
      setAuthors([...authors, ...newAuthors]);
    }
  }

  function handleTabChange(newTab: CommonsModule) {
    setActiveTab(newTab);
    setActivePage(1);
  }

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
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
              <div className="my-8 flex flex-row items-center justify-center w-full">
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
                      value={searchString}
                      onChange={(e) => {
                        setSearchString(e.target.value);
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
                          updateSearchParam(searchString); // Trigger search on Enter key press
                        }
                      }}
                    >
                      <Icon name="search" />
                      <input />
                      {(searchString !== "" ||
                        Object.keys(assetsState).length !== 0 ||
                        Object.keys(booksState).length !== 0) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleResetSearch();
                          }}
                          className="!-mt-[0.25px] !-mb-[0.25px] !px-2 !py-0 !bg-white !border-y-[1.57px] !border-gray-200"
                        >
                          <Icon name="close" color="grey" />
                        </button>
                      )}
                      <Button
                        color="blue"
                        onClick={() => updateSearchParam(searchString)}
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
              <CatalogTabs
                assetFilters={assetsState}
                assetFiltersDispatch={assetsDispatch}
                authorFilters={authorsState}
                authorFiltersDispatch={authorsDispatch}
                bookFilters={booksState}
                bookFiltersDispatch={booksDispatch}
                activeTab={activeTab}
                onActiveTabChange={handleTabChange}
                books={books}
                booksCount={booksCount}
                assets={assets}
                assetsCount={assetsCount}
                miniRepos={miniRepos}
                miniRepoFilters={miniReposState}
                miniRepoFiltersDispatch={miniReposDispatch}
                miniReposCount={miniReposCount}
                miniReposLoading={miniReposLoading}
                projectFilters={projectsState}
                projectFiltersDispatch={projectsDispatch}
                projects={projects}
                projectsCount={projectsCount}
                booksLoading={booksLoading}
                assetsLoading={assetsLoading}
                projectsLoading={projectsLoading}
                authors={authors}
                authorsCount={authorsCount}
                authorsLoading={authorsLoading}
                onLoadMoreBooks={handleLoadMoreBooks}
                onLoadMoreAssets={handleLoadMoreAssets}
                onLoadMoreMiniRepos={handleLoadMoreMiniRepos}
                onLoadMoreProjects={handleLoadMoreProjects}
                onLoadMoreAuthors={handleLoadMoreAuthors}
                onTriggerStopLoading={() => setLoadingDisabled(true)}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
