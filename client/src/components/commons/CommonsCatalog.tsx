import "./Commons.css";
import { Grid, Segment, Header, Form, Dropdown } from "semantic-ui-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useTypedSelector } from "../../state/hooks";
import { useLocation, useHistory } from "react-router-dom";
import useGlobalError from "../error/ErrorHooks";
import {
  AssetFilters,
  Book,
  BookFilters,
  Project,
  ProjectFileWProjectID,
} from "../../types";
import api from "../../api";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import VisualMode from "./CommonsCatalog/VisualMode";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";
import CatalogAssetFilters from "./CommonsCatalog/CatalogAssetFilters";
import InfiniteScroll from "react-infinite-scroll-component";

const CommonsCatalog = () => {
  const { handleGlobalError, error } = useGlobalError();

  // Global State and Location/History
  const location = useLocation();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  // Data
  const [books, setBooks] = useState<Book[]>([]);
  const [booksTotal, setBooksTotal] = useState<number>(0);
  const [files, setFiles] = useState<ProjectFileWProjectID[]>([]);
  const [filesTotal, setFilesTotal] = useState<number>(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsTotal, setProjectsTotal] = useState<number>(0);

  /** UI **/
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [activeBookPage, setActiveBookPage] = useState<number>(1);
  const [activeAssetPage, setActiveAssetPage] = useState<number>(1);
  const [activeProjectPage, setActiveProjectPage] = useState<number>(1);
  const [loadedData, setLoadedData] = useState<boolean>(true);
  const [isInitialSearch, setIsInitialSearch] = useState<boolean>(true);
  const [strictMode, setStrictMode] = useState<boolean>(false);

  // const initialSearch = useRef(true);
  // const checkedParams = useRef(false);
  const catalogTabsRef = useRef<React.ElementRef<typeof CatalogTabs>>(null);
  const catalogBookFiltersRef =
    useRef<React.ElementRef<typeof CatalogBookFilters>>(null);
  const catalogAssetFiltersRef =
    useRef<React.ElementRef<typeof CatalogAssetFilters>>(null);

  const [searchString, setSearchString] = useState<string>("");

  // Sort and Search Filters
  const [sortChoice, setSortChoice] = useState("random");
  const [displayChoice, setDisplayChoice] = useState("visual");

  const sortOptions = [
    { key: "random", text: "Sort by...", value: "random" },
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
  ];

  /**
   * Get filter options from server
   * on initial load.
   */
  useEffect(() => {
    loadCommonsCatalog();
    loadPublicAssets();
    loadPublicProjects();
  }, []);

  useEffect(() => {
    if (!isInitialSearch) return;
    loadCommonsCatalog();
  }, [activeBookPage]);

  useEffect(() => {
    if (!isInitialSearch) return;
    loadPublicAssets();
  }, [activeAssetPage]);

  useEffect(() => {
    if (!isInitialSearch) return;
    loadPublicProjects();
  }, [activeProjectPage]);

  /**
   * Update the page title based on
   * Organization information.
   */
  useEffect(() => {
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | Catalog`;
    } else {
      document.title = "LibreCommons | Catalog";
    }
  }, [org]);

  async function loadCommonsCatalog() {
    try {
      setLoadedData(false);
      const res = await api.getCommonsCatalog({
        activePage: activeBookPage,
        limit: itemsPerPage,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.books)) {
        setBooks([...books, ...res.data.books]);
      }
      if (typeof res.data.numTotal === "number") {
        setBooksTotal(res.data.numTotal);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }

  async function loadPublicAssets() {
    try {
      setLoadedData(false);
      const res = await api.getPublicProjectFiles({
        page: activeAssetPage,
        limit: itemsPerPage,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.files)) {
        setFiles([...files, ...res.data.files]);
      }
      if (typeof res.data.totalCount === "number") {
        setFilesTotal(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }

  async function loadPublicProjects() {
    try {
      setLoadedData(false);
      const res = await api.getPublicProjects({
        page: activeAssetPage,
        limit: itemsPerPage,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.projects)) {
        setProjects([...projects, ...res.data.projects]);
      }
      if (typeof res.data.totalCount === "number") {
        setProjectsTotal(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }

  const resetState = () => {
    setActiveBookPage(1);
    setActiveAssetPage(1);
    setActiveProjectPage(1);
    setBooks([]);
    setFiles([]);
    setProjects([]);
  };

  const handleResetSearch = () => {
    setIsInitialSearch(true);
    setSearchString("");
    catalogBookFiltersRef.current?.resetFilters();
    catalogAssetFiltersRef.current?.resetFilters();
    resetState();
    loadCommonsCatalog();
    loadPublicAssets();
    loadPublicProjects();
  };

  // Resets state and performs search based on active tab.
  const updateQueryAndSearch = () => {
    resetState();
    const activeTab = catalogTabsRef.current?.getActiveTab();
    if (activeTab === "books") {
      booksSearch();
    }
    if (activeTab === "assets") {
      assetsSearch();
    }
    if (activeTab === "projects") {
      projectsSearch();
    }
  };

  /**
   * Perform GET request for books
   * and update catalogBooks.
   */
  const assetsSearch = async () => {
    try {
      setLoadedData(false);
      setIsInitialSearch(false);

      const assetFilters = catalogAssetFiltersRef.current?.getSelectedFilters();

      const res = await api.assetsSearch({
        searchQuery: searchString,
        strictMode,
        page: activeAssetPage,
        limit: itemsPerPage,
        ...assetFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        setFiles(res.data.results);
      }
      if (typeof res.data.numResults === "number") {
        setFilesTotal(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

  const booksSearch = async () => {
    try {
      setLoadedData(false);
      setIsInitialSearch(false);

      const bookFilters = catalogBookFiltersRef.current?.getSelectedFilters();

      const res = await api.booksSearch({
        searchQuery: searchString,
        strictMode,
        page: activeBookPage,
        limit: itemsPerPage,
        ...bookFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        setBooks(res.data.results);
      }

      if (typeof res.data.numResults === "number") {
        setBooksTotal(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

  const projectsSearch = async () => {
    try {
      setLoadedData(false);
      setIsInitialSearch(false);

      const res = await api.projectsSearch({
        searchQuery: searchString,
        strictMode,
        page: activeProjectPage,
        limit: itemsPerPage,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        setProjects(res.data.results);
      }

      if (typeof res.data.numResults === "number") {
        setProjectsTotal(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

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
                    updateQueryAndSearch();
                  }}
                >
                  <Form.Input
                    icon="search"
                    placeholder="Search..."
                    className="color-libreblue"
                    id="commons-search-input"
                    iconPosition="left"
                    onChange={(e) => {
                      setSearchString(e.target.value);
                    }}
                    fluid
                    value={searchString}
                    aria-label="Search query"
                    action={{
                      content: "Search Catalog",
                      color: "blue",
                      onClick: updateQueryAndSearch,
                    }}
                  />
                </Form>
                <p
                  className="underline cursor-pointer text-center mt-4"
                  onClick={handleResetSearch}
                >
                  Reset Search
                </p>
              </div>
              <CatalogTabs
                paneProps={{ loading: false }}
                ref={catalogTabsRef}
                fireTabChange={updateQueryAndSearch}
                booksCount={isInitialSearch ? booksTotal : books.length}
                assetsCount={isInitialSearch ? filesTotal : files.length}
                projectsCount={
                  isInitialSearch ? projectsTotal : projects.length
                }
                booksContent={
                  <>
                    <CatalogBookFilters
                      ref={catalogBookFiltersRef}
                      onFiltersChange={updateQueryAndSearch}
                      strictMode={strictMode}
                      onStrictModeChange={(mode) => setStrictMode(mode)}
                    />
                    <InfiniteScroll
                      dataLength={books.length}
                      next={() => setActiveBookPage(activeBookPage + 1)}
                      hasMore={books.length < booksTotal}
                      loader={
                        <p className="text-center font-semibold mt-4">
                          Loading...
                        </p>
                      }
                      endMessage={
                        <p className="text-center mt-4 italic">
                          End of Results
                        </p>
                      }
                    >
                      <VisualMode items={books} />
                    </InfiniteScroll>
                  </>
                }
                assetsContent={
                  <>
                    <CatalogAssetFilters
                      ref={catalogAssetFiltersRef}
                      onFiltersChange={updateQueryAndSearch}
                      strictMode={strictMode}
                      onStrictModeChange={(mode) => setStrictMode(mode)}
                    />
                    <InfiniteScroll
                      dataLength={files.length}
                      next={() => setActiveAssetPage(activeAssetPage + 1)}
                      hasMore={files.length < filesTotal}
                      loader={
                        <p className="text-center font-semibold mt-4">
                          Loading...
                        </p>
                      }
                      endMessage={
                        <p className="text-center mt-4 italic">
                          End of Results
                        </p>
                      }
                    >
                      <VisualMode items={files} />
                    </InfiniteScroll>
                  </>
                }
                projectsContent={
                  <InfiniteScroll
                    dataLength={projects.length}
                    next={() => setActiveProjectPage(activeProjectPage + 1)}
                    hasMore={projects.length < projectsTotal}
                    loader={
                      <p className="text-center font-semibold mt-4">
                        Loading...
                      </p>
                    }
                    endMessage={
                      <p className="text-center mt-4 italic">End of Results</p>
                    }
                  >
                    <VisualMode items={projects} />
                  </InfiniteScroll>
                }
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
