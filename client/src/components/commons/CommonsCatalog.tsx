import "./Commons.css";
import { Grid, Segment, Header, Form, Dropdown } from "semantic-ui-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useTypedSelector } from "../../state/hooks";
import { useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import useGlobalError from "../error/ErrorHooks";
import { updateParams } from "../util/HelperFunctions.js";
import {
  AssetFilters,
  Book,
  BookFilters,
  CatalogLocation,
  GenericKeyTextValueObj,
  Project,
  ProjectFileWProjectID,
} from "../../types";
import api from "../../api";
import CatalogTable from "./CommonsCatalog/CatalogTable";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import VisualMode from "./CommonsCatalog/VisualMode";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";
import CatalogAssetFilters from "./CommonsCatalog/CatalogAssetFilters";

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

  // const initialSearch = useRef(true);
  // const checkedParams = useRef(false);
  const catalogTabsRef = useRef<React.ElementRef<typeof CatalogTabs>>(null);
  const catalogBookFiltersRef = useRef<React.ElementRef<typeof CatalogBookFilters>>(null);
  const catalogAssetFiltersRef = useRef<React.ElementRef<typeof CatalogAssetFilters>>(null);

  const { observe } = useInfiniteScroll(
    () => {
      if (catalogTabsRef.current?.getActiveTab() === "books") {
        setActiveBookPage(activeBookPage + 1);
      } else if (catalogTabsRef.current?.getActiveTab() === "assets") {
        setActiveAssetPage(activeAssetPage + 1);
      } else if (catalogTabsRef.current?.getActiveTab() === "projects") {
        setActiveProjectPage(activeProjectPage + 1);
      } else {
        console.error("No active tab")
      }
    },
    {
      loading: !loadedData,
      preventUnobserve: true,
    }
  );

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
    //searchCommonsCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCommonsCatalog();
  }, [activeBookPage]);

  useEffect(() => {
    loadPublicAssets();
  }, [activeAssetPage])

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

  // useEffect(() => {
  //   if (includeCampus && includeCentral) {
  //     setLocationFilter("all");
  //   } else if (includeCampus && !includeCentral) {
  //     setLocationFilter("campus");
  //   } else if (!includeCampus && includeCentral) {
  //     setLocationFilter("central");
  //   } else {
  //     //Fallback to all if both are unchecked
  //     setIncludeCampus(true);
  //     setIncludeCentral(true);
  //     setLocationFilter("all");
  //   }
  // }, [includeCampus, includeCentral]);

  /**
   * Watch selected locations and automatically re-search
   */
  // useEffect(() => {
  //   performSearch();
  // }, [locationFilter]);

  /**
   * Build the new search URL and push it onto the history stack.
   * Change to location triggers the network request to fetch results.
   */
  // const performSearch = () => {
  //   let sort = sortChoice;
  //   if (!initialSearch.current) {
  //     initialSearch.current = true;
  //     /* change to ordered on first search */
  //     if (sort !== "title" && sort !== "author") {
  //       sort = "title";
  //     }
  //   }
  //   let searchURL = location.search;
  //   searchURL = updateParams(searchURL, "search", searchString);
  //   searchURL = updateParams(searchURL, "library", libraryFilter);
  //   searchURL = updateParams(searchURL, "subject", subjectFilter);
  //   searchURL = updateParams(searchURL, "location", locationFilter);
  //   searchURL = updateParams(searchURL, "author", authorFilter);
  //   searchURL = updateParams(searchURL, "license", licenseFilter);
  //   searchURL = updateParams(searchURL, "affiliation", affilFilter);
  //   searchURL = updateParams(searchURL, "course", courseFilter);
  //   searchURL = updateParams(searchURL, "publisher", pubFilter);
  //   searchURL = updateParams(searchURL, "cid", cidFilter);
  //   searchURL = updateParams(searchURL, "sort", sort);
  //   history.push({
  //     pathname: location.pathname,
  //     search: searchURL,
  //   });
  // };

  // const resetSearch = () => {
  //   setSearchString("");
  //   setLibraryFilter("");
  //   setSubjectFilter("");
  //   setLocationFilter(org.orgID === "libretexts" ? "all" : "campus");
  //   setAuthorFilter("");
  //   setLicenseFilter("");
  //   setAffilFilter("");
  //   setCourseFilter("");
  //   setPubFilter("");
  //   setCIDFilter("");
  //   let searchURL = location.search;
  //   searchURL = updateParams(searchURL, "search", "");
  //   searchURL = updateParams(searchURL, "library", "");
  //   searchURL = updateParams(searchURL, "subject", "");
  //   searchURL = updateParams(searchURL, "location", "");
  //   searchURL = updateParams(searchURL, "author", "");
  //   searchURL = updateParams(searchURL, "license", "");
  //   searchURL = updateParams(searchURL, "affiliation", "");
  //   searchURL = updateParams(searchURL, "course", "");
  //   searchURL = updateParams(searchURL, "publisher", "");
  //   searchURL = updateParams(searchURL, "cid", "");
  //   history.push({
  //     pathname: location.pathname,
  //     search: searchURL,
  //   });
  // };

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
        setBooks([...books, ...res.data.books])
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

  // /**
  //  * Perform GET request for books
  //  * and update catalogBooks.
  //  */
  // const searchCommonsCatalog = async () => {
  //   try {
  //     setLoadedData(false);
  //     let paramsObj: FilterParams = {
  //       sort: sortChoice,
  //     };
  //     if (!isEmptyString(searchString)) {
  //       paramsObj.search = searchString;
  //     }
  //     if (!isEmptyString(libraryFilter)) {
  //       paramsObj.library = libraryFilter;
  //     }
  //     if (!isEmptyString(subjectFilter)) {
  //       paramsObj.subject = subjectFilter;
  //     }
  //     if (!isEmptyString(locationFilter)) {
  //       paramsObj.location = locationFilter;
  //     }
  //     if (!isEmptyString(authorFilter)) {
  //       paramsObj.author = authorFilter;
  //     }
  //     if (!isEmptyString(licenseFilter)) {
  //       paramsObj.license = licenseFilter;
  //     }
  //     if (!isEmptyString(affilFilter)) {
  //       paramsObj.affiliation = affilFilter;
  //     }
  //     if (!isEmptyString(courseFilter)) {
  //       paramsObj.course = courseFilter;
  //     }
  //     if (!isEmptyString(pubFilter)) {
  //       paramsObj.publisher = pubFilter;
  //     }
  //     if (!isEmptyString(cidFilter)) {
  //       paramsObj.cidDescriptor = cidFilter;
  //     }

  //     const res = await axios.get("/commons/catalog", {
  //       params: paramsObj,
  //     });

  //     if (res.data.err) {
  //       throw new Error(res.data.errMsg);
  //     }

  //     if (Array.isArray(res.data.books)) {
  //       setAllItems(res.data.books);
  //     }
  //     if (typeof res.data.numFound === "number") {
  //       setNumResultItems(res.data.numFound);
  //     }
  //     if (typeof res.data.numTotal === "number") {
  //       setNumTotalItems(res.data.numTotal);
  //     }
  //   } catch (err) {
  //     handleGlobalError(err);
  //   } finally {
  //     setLoadedData(true);
  //   }
  // };

  const resetState = () => {
    setActiveBookPage(1);
    setActiveAssetPage(1);
    setActiveProjectPage(1);
    setBooks([]);
    setFiles([]);
    setProjects([]);
  }


  const handleResetSearch = () => {
    setIsInitialSearch(true);
    setSearchString("");
    catalogBookFiltersRef.current?.resetFilters();
    catalogAssetFiltersRef.current?.resetFilters();
    resetState();
    loadCommonsCatalog();
    loadPublicAssets();
    loadPublicProjects();
  }

  const handleFiltersChanged = (filters: BookFilters | AssetFilters) => {
    if(Object.keys(filters).length === 0) return;
    newSearch();
  }

  const updateQueryAndSearch = () => {
    resetState();
    newSearch();
  }

  /**
   * Perform GET request for books
   * and update catalogBooks.
   */
  const newSearch = async () => {
    try {
      setLoadedData(false);
      setIsInitialSearch(false);

      const bookFilters = catalogBookFiltersRef.current?.getSelectedFilters();
      const assetFilters = catalogAssetFiltersRef.current?.getSelectedFilters();
      if(!searchString) return; //TODO: Remove this?

      const res = await api.conductorSearch({
        searchQuery: searchString,
        assetsPage: activeAssetPage,
        assetsLimit: itemsPerPage,
        booksPage: activeBookPage,
        booksLimit: itemsPerPage,
        projectsPage: activeProjectPage,
        projectsLimit: itemsPerPage,
        ...bookFilters,
        ...assetFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if(Array.isArray(res.data.results.books)) {
        setBooks(res.data.results.books);
      }
      if(Array.isArray(res.data.results.files)) {
        setFiles(res.data.results.files);
      }
      if(Array.isArray(res.data.results.projects)) {
        setProjects(res.data.results.projects);
      }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

  /**
   * Perform the Catalog search based on
   * URL query change after ensuring the
   * initial URL params sync has been
   * performed.
   */
  // useEffect(() => {
  //   if (checkedParams.current) {
  //     // searchCommonsCatalog();
  //   }
  // }, [checkedParams.current]);

  /**
   * Update the URL query with the sort choice
   * AFTER a search has been performed and a
   * change has been made.
   */
  // useEffect(() => {
  //   if (initialSearch.current) {
  //     const searchURL = updateParams(location.search, "sort", sortChoice);
  //     history.push({
  //       pathname: location.pathname,
  //       search: searchURL,
  //     });
  //   }
  // }, [sortChoice]);

  /**
   * Update the URL query with the display mode
   * AFTER a search has been performed and a
   * change has been made.
   */
  // useEffect(() => {
  //   if (initialSearch.current) {
  //     const searchURL = updateParams(location.search, "mode", displayChoice);
  //     history.push({
  //       pathname: location.pathname,
  //       search: searchURL,
  //     });
  //   }
  // }, [displayChoice]);

  /**
   * Subscribe to changes in the URL search string
   * and update state accordingly.
   */
  // useEffect(() => {
  //   let params = queryString.parse(location.search);
  //   if (Object.keys(params).length > 0 && !initialSearch.current) {
  //     // enable results for those entering a direct search URL
  //     initialSearch.current = true;
  //   }
  //   if (params.mode && params.mode !== displayChoice) {
  //     if (params.mode === "visual" || params.mode === "itemized") {
  //       setDisplayChoice(params.mode);
  //     }
  //   }
  //   if (
  //     params.items &&
  //     typeof params.items === "number" &&
  //     parseInt(params.items) !== itemsPerPage
  //   ) {
  //     if (!isNaN(parseInt(params.items))) {
  //       setItemsPerPage(params.items);
  //     }
  //   }
  //   // if (
  //   //   params.search !== undefined &&
  //   //   params.search !== searchString &&
  //   //   typeof params.search === "string"
  //   // ) {
  //   //   setSearchString(params.search);
  //   // }
  //   if (
  //     params.sort !== undefined &&
  //     params.sort !== sortChoice &&
  //     typeof params.sort === "string"
  //   ) {
  //     setSortChoice(params.sort);
  //   }
  //   if (
  //     params.library !== undefined &&
  //     params.library !== libraryFilter &&
  //     typeof params.library === "string"
  //   ) {
  //     setLibraryFilter(params.library);
  //   }
  //   if (
  //     params.subject !== undefined &&
  //     params.subject !== subjectFilter &&
  //     typeof params.subject === "string"
  //   ) {
  //     setSubjectFilter(params.subject);
  //   }
  //   if (
  //     params.location !== undefined &&
  //     params.location !== locationFilter &&
  //     typeof params.location === "string" &&
  //     isCatalogLocation(params.location)
  //   ) {
  //     if (params.location === "all") {
  //       setIncludeCampus(true);
  //       setIncludeCentral(true);
  //     } else if (params.location === "campus") {
  //       setIncludeCampus(true);
  //       setIncludeCentral(false);
  //     } else if (params.location === "central") {
  //       setIncludeCampus(false);
  //       setIncludeCentral(true);
  //     } else {
  //       setIncludeCampus(false);
  //       setIncludeCentral(false);
  //     }
  //     setLocationFilter(params.location);
  //   }
  //   if (
  //     params.license !== undefined &&
  //     params.license !== licenseFilter &&
  //     typeof params.license === "string"
  //   ) {
  //     setLicenseFilter(params.license);
  //   }
  //   if (
  //     params.author !== undefined &&
  //     params.author !== authorFilter &&
  //     typeof params.author === "string"
  //   ) {
  //     setAuthorFilter(params.author);
  //   }
  //   if (
  //     params.affiliation !== undefined &&
  //     params.affiliation !== affilFilter &&
  //     typeof params.affiliation === "string"
  //   ) {
  //     setAffilFilter(params.affiliation);
  //   }
  //   if (
  //     params.course !== undefined &&
  //     params.course !== courseFilter &&
  //     typeof params.course === "string"
  //   ) {
  //     setCourseFilter(params.course);
  //   }
  //   if (
  //     params.publisher !== undefined &&
  //     params.publisher !== pubFilter &&
  //     typeof params.publisher === "string"
  //   ) {
  //     setPubFilter(params.publisher);
  //   }
  //   if (
  //     params.cid !== undefined &&
  //     params.cid !== cidFilter &&
  //     typeof params.cid === "string"
  //   ) {
  //     setCIDFilter(params.cid);
  //   }
  //   if (!checkedParams.current) {
  //     // set the initial URL params sync to complete
  //     checkedParams.current = true;
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [location.search]);

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
                <Form onSubmit={(e) => {
                  e.preventDefault();
                  updateQueryAndSearch();
                }}>
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
                <p className="underline cursor-pointer text-center mt-4" onClick={handleResetSearch}>Reset Search</p>
              </div>
              <CatalogTabs
                paneProps={{ loading: false }}
                booksCount={isInitialSearch ? booksTotal : books.length}
                assetsCount={isInitialSearch ? filesTotal : files.length}
                projectsCount={isInitialSearch ? projectsTotal : projects.length}
                booksContent={
                  <>
                    <CatalogBookFilters ref={catalogBookFiltersRef} onFiltersChange={(filters) => handleFiltersChanged(filters)} />
                    <VisualMode items={books} />
                  </>
                }
                assetsContent={
                  <>
                    <CatalogAssetFilters ref={catalogAssetFiltersRef} onFiltersChange={(filters) => handleFiltersChanged(filters)}/>
                    <VisualMode items={files} />
                  </>
                }
                projectsContent={
                  <VisualMode items={projects} />
                }
                ref={catalogTabsRef}
              />
              <div
                className="commons-content-card-grid-sentry text-center"
                ref={observe}
              ></div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
