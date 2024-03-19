import "./Commons.css";
import { Grid, Segment, Header, Form, Icon, Button } from "semantic-ui-react";
import { useEffect, useState, useRef, useReducer } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import useDebounce from "../../hooks/useDebounce";
import {
  AssetFilters,
  AssetFiltersAction,
  Book,
  BookFilters,
  BookFiltersAction,
  CommonsModule,
  Project,
  ProjectFileWProjectData,
} from "../../types";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { useHistory, useLocation } from "react-router-dom";
import { truncateString } from "../util/HelperFunctions";
import { getDefaultCommonsModule } from "../../utils/misc";

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

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const ITEMS_PER_PAGE = 24;

  const [assetsState, assetsDispatch] = useReducer(assetsReducer, {});
  const [booksState, booksDispatch] = useReducer(booksReducer, {});

  const [showSuggestions, setShowSuggestions] = useState(true);

  const [loadingDisabled, setLoadingDisabled] = useState(false);

  const [searchString, setSearchString] = useState<string>("");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<CommonsModule>(
    getDefaultCommonsModule(org.commonsModules)
  );
  const [activePage, setActivePage] = useState(1);

  const [books, setBooks] = useState<Book[]>([]);
  const [booksCount, setBooksCount] = useState<number>(0);

  const [assets, setAssets] = useState<
    ProjectFileWProjectData<"title" | "thumbnail">[]
  >([]);
  const [assetsCount, setAssetsCount] = useState<number>(0);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);

  const [booksLoading, setBooksLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);

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
    });
  }, [assetsState, booksState, location.search]);

  const getSuggestionsDebounced = debounce(
    (searchVal: string) => getSearchSuggestions(searchVal),
    150
  );

  const updateSearchParam = (searchString: string) => {
    const search = searchString.trim();
    const url = new URL(window.location.href);

    if (search === "") {
      clearSearchParam();
      if (assetFiltersApplied() || bookFiltersApplied()) {
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

      // Reset the advanced search filters when a new search is run
      assetsDispatch({ type: "reset", payload: "" });
      booksDispatch({ type: "reset" });
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
    booksDispatch({ type: "reset" });
    setActivePage(1);
    setBooks([]);
    setAssets([]);
    setProjects([]);
    loadInitialData(true);
  };

  async function runSearch({
    query,
    assetFilters,
    bookFilters,
  }: {
    query?: string;
    assetFilters?: AssetFilters;
    bookFilters?: BookFilters;
  }) {
    try {
      if (loadingDisabled) return;
      setActivePage(1);

      if (
        !query &&
        (!assetFilters || !Object.keys(assetFilters).length) &&
        (!bookFilters || !Object.keys(bookFilters).length)
      ) {
        return loadInitialData(true);
      }

      await Promise.all([
        handleBooksSearch(query ?? searchString, bookFilters, true),
        handleAssetsSearch(query ?? searchString, assetFilters, true),
        handleProjectsSearch(query ?? searchString, true),
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
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  // Books
  async function loadCommonsCatalog(clear = false) {
    try {
      setBooksLoading(true);
      const res = await api.getCommonsCatalog({
        activePage: activePage,
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
    clearAndUpdate = false
  ) {
    try {
      setBooksLoading(true);
      const res = await api.booksSearch({
        ...(query && { searchQuery: query }),
        page: activePage,
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
    clearAndUpdate = false
  ) {
    try {
      setAssetsLoading(true);

      const customFiltersApplied = Object.entries(assetFilters ?? {})
        .filter(([key, value]) => !["license", "org", "fileType"].includes(key))
        .map(([key, value]) => ({ key, value }));

      const res = await api.assetsSearch({
        ...(query && { searchQuery: query }),
        page: activePage,
        limit: ITEMS_PER_PAGE,
        license: assetFilters?.license,
        fileType: assetFilters?.fileType,
        org: assetFilters?.org,
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

  async function handleProjectsSearch(query?: string, clearAndUpdate = false) {
    try {
      setProjectsLoading(true);
      const res = await api.projectsSearch({
        searchQuery: query,
        page: activePage,
        limit: ITEMS_PER_PAGE,
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

  const bookFiltersApplied = (): boolean => {
    return Object.keys(booksState).length > 0;
  };

  const assetFiltersApplied = (): boolean => {
    return Object.keys(assetsState).length > 0;
  };

  function handleLoadMoreBooks() {
    if (loadingDisabled) return;
    setActivePage(activePage + 1);
    if (searchString || bookFiltersApplied()) {
      return handleBooksSearch(searchString);
    } else {
      return loadCommonsCatalog();
    }
  }

  function handleLoadMoreAssets() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    if (searchString || assetFiltersApplied()) {
      return handleAssetsSearch(searchString);
    } else {
      return loadPublicAssets();
    }
  }

  function handleLoadMoreProjects() {
    if (loadingDisabled) return;
    setActivePage(activePage + 1);
    if (searchString) {
      return handleProjectsSearch(searchString);
    } else {
      return loadPublicProjects();
    }
  }

  /**
   * This is a workaround to handle cases where we want to clear the existing state,
   * but React doesn't update the state immediately/recognize the change.
   * This helps us distinguish between the case where a new search was ran and no results were found,
   * and the case where we are just loading more results, and don't want to clear the existing state.
   */
  function updateAssets(
    newAssets: ProjectFileWProjectData<"title" | "thumbnail">[],
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

  function updateProjects(newProjects: Project[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setProjects([...newProjects]);
    } else {
      setProjects([...projects, ...newProjects]);
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
              <div className="mt-8 mb-6 mx-56">
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <Form.Input
                      placeholder="Search..."
                      className="!mb-0 !border-r-none"
                      id="commons-search-input"
                      icon="search"
                      iconPosition="left"
                      onChange={(e) => {
                        setSearchString(e.target.value);
                        getSuggestionsDebounced(e.target.value);
                        if (e.target.value.length === 0) {
                          setShowSuggestions(false);
                        } else {
                          setShowSuggestions(true);
                        }
                      }}
                      fluid
                      value={searchString}
                      aria-label="Search query"
                      onBlur={() => {
                        setTimeout(() => {
                          setShowSuggestions(false); // Delay to allow suggestion click event to fully run
                        }, 200);
                      }}
                      action
                    >
                      <Icon name="search" />
                      <input />
                      {(searchString !== "" ||
                        Object.keys(assetsState).length !== 0 ||
                        Object.keys(booksState).length !== 0) && (
                        <button
                          onClick={handleResetSearch}
                          className="!-mt-[0.25px] !px-2 !py-0 !bg-white !border-y-[1.5px] !border-gray-2ks00"
                        >
                          <Icon name="close" color="grey" />
                        </button>
                      )}
                      <Button
                        color="blue"
                        onClick={() => updateSearchParam(searchString)}
                        className="!m-0"
                      >
                        <Icon name="search" />
                        Search Catalog
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
                bookFilters={booksState}
                bookFiltersDispatch={booksDispatch}
                activeTab={activeTab}
                onActiveTabChange={handleTabChange}
                books={books}
                booksCount={booksCount}
                assets={assets}
                assetsCount={assetsCount}
                projects={projects}
                projectsCount={projectsCount}
                booksLoading={booksLoading}
                assetsLoading={assetsLoading}
                projectsLoading={projectsLoading}
                onLoadMoreBooks={handleLoadMoreBooks}
                onLoadMoreAssets={handleLoadMoreAssets}
                onLoadMoreProjects={handleLoadMoreProjects}
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
