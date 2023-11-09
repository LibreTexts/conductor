import "./Commons.css";

import { Link } from "react-router-dom";
import {
  Grid,
  Image,
  Dropdown,
  Segment,
  Table,
  Header,
  Icon,
  Button,
  Form,
  PaginationProps,
  Checkbox,
} from "semantic-ui-react";
import { useEffect, useState, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import { useLocation, useHistory } from "react-router-dom";
import Breakpoint from "../util/Breakpoints";
import ConductorPagination from "../util/ConductorPagination";
import axios from "axios";
import queryString from "query-string";
import {
  libraryOptions,
  getLibGlyphURL,
  getLibGlyphAltText,
} from "../util/LibraryOptions.js";
import { licenseOptions } from "../util/LicenseOptions.js";
import useGlobalError from "../error/ErrorHooks";
import { catalogItemsPerPageOptions } from "../util/PaginationOptions.js";
import { catalogDisplayOptions } from "../util/CatalogOptions";
import { updateParams, isEmptyString } from "../util/HelperFunctions.js";
import { ResultsText } from "../util/ConductorPagination";
import {
  Book,
  CatalogLocation,
  GenericKeyTextValueObj,
  ProjectFile,
} from "../../types";
import { isCatalogLocation } from "../../utils/typeHelpers";
import { sanitizeCustomColor } from "../../utils/campusSettingsHelpers";
import CatalogCard from "./CommonsCatalog/CatalogCard";
import api from "../../api";
import CatalogTable from "./CommonsCatalog/CatalogTable";
import { useQueryState } from "../../hooks/useQueryState";

const CommonsCatalog = () => {
  const { handleGlobalError } = useGlobalError();

  // Global State and Location/History
  const location = useLocation();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  // Data
  const [items, setItems] = useState<Array<Book | ProjectFile>>([]);
  const [numResultItems, setNumResultItems] = useState<number>(0);
  const [numTotalItems, setNumTotalItems] = useState<number>(0);

  /** UI **/
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [loadedData, setLoadedData] = useState<boolean>(false);

  const [loadedFilters, setLoadedFilters] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const initialSearch = useRef(true);
  const checkedParams = useRef(false);

  // Content Filters
  type FilterParams = {
    sort: string;
    search?: string;
    library?: string;
    subject?: string;
    location?: string;
    author?: string;
    license?: string;
    affiliation?: string;
    course?: string;
    publisher?: string;
    cidDescriptor?: string;
    assets?: boolean;
  };
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [libraryFilter, setLibraryFilter] = useQueryState<string>("library");
  const [locationFilter, setLocationFilter] = useQueryState<string>("location");
  const [subjectFilter, setSubjectFilter] = useQueryState<string>("subject");
  const [authorFilter, setAuthorFilter] = useQueryState<string>("author");
  const [licenseFilter, setLicenseFilter] = useQueryState<string>("license");
  const [affilFilter, setAffilFilter] = useQueryState<string>("affiliation");
  const [instrFilter, setInstrFilter] = useQueryState<string>("instructor");
  const [courseFilter, setCourseFilter] = useQueryState<string>("course");
  const [pubFilter, setPubFilter] = useQueryState<string>("publisher");
  const [cidFilter, setCIDFilter] = useQueryState<string>("cid");
  const [displayMode, setDisplayMode] = useQueryState<string>("mode", {defaultValue: "visual"});
  const [includeCentral, setIncludeCentral] = useQueryState<boolean>(
    "central",
    { coerce: "boolean" }
  );
  const [includeCampus, setIncludeCampus] = useQueryState<boolean>("campus", {
    coerce: "boolean",
  });
  const [includeAssets, setIncludeAssets] = useQueryState<boolean>("assets", {
    coerce: "boolean",
  });

  const [subjectOptions, setSubjectOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [authorOptions, setAuthorOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [affOptions, setAffOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [courseOptions, setCourseOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pubOptions, setPubOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [cidOptions, setCIDOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);

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
    getFilterOptions();
    searchCommonsCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
   * Perform GET request for books
   * and update catalogBooks.
   */
  const searchCommonsCatalog = async () => {
    try {
      setLoadedData(false);
      // let paramsObj: FilterParams = {
      //   sort: sortChoice,
      //   search: searchQuery,
      //   library: libraryFilter,
      //   subject: subjectFilter,
      //   location: locationFilter,
      //   author: authorFilter,
      //   license: licenseFilter,
      //   affiliation: affilFilter,
      //   course: courseFilter,
      //   publisher: pubFilter,
      //   cidDescriptor: cidFilter,
      //   assets: includeAssets,
      // };

      // console.log(paramsObj.search);
      const res = await api.conductorSearch({
        searchQuery,
        activePage,
        limit: itemsPerPage,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      setItems([...res.data.results.books, ...res.data.results.files]);

      if (typeof res.data.numResults === "number") {
        setNumResultItems(res.data.numResults);
        const totalPages = Math.ceil(res.data.numResults / itemsPerPage);
        setTotalPages(totalPages);
      }
      // if (typeof res.data.numTotal === "number") {
      //   setNumTotalBooks(res.data.numTotal);
      // }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

  /**
   * Retrieve the list(s) of dynamic
   * filter options from the server.
   */
  const getFilterOptions = async () => {
    try {
      const res = await axios.get("/commons/filters");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      const newAuthorOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newSubjectOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newAffOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newCourseOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newPubOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newCIDOptions = [{ key: "empty", text: "Clear...", value: "" }];

      if (res.data.authors && Array.isArray(res.data.authors)) {
        res.data.authors.forEach((author: string) => {
          newAuthorOptions.push({
            key: author,
            text: author,
            value: author,
          });
        });
      }
      if (res.data.subjects && Array.isArray(res.data.subjects)) {
        res.data.subjects.forEach((subject: string) => {
          newSubjectOptions.push({
            key: subject,
            text: subject,
            value: subject,
          });
        });
      }
      if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
        res.data.affiliations.forEach((affiliation: string) => {
          newAffOptions.push({
            key: affiliation,
            text: affiliation,
            value: affiliation,
          });
        });
      }
      if (res.data.courses && Array.isArray(res.data.courses)) {
        res.data.courses.forEach((course: string) => {
          newCourseOptions.push({
            key: course,
            text: course,
            value: course,
          });
        });
      }
      if (res.data.publishers && Array.isArray(res.data.publishers)) {
        res.data.publishers.forEach((publisher: string) => {
          newPubOptions.push({
            key: publisher,
            text: publisher,
            value: publisher,
          });
        });
      }
      if (Array.isArray(res.data.cids)) {
        res.data.cids.forEach((descriptor: string) => {
          newCIDOptions.push({
            key: descriptor,
            text: descriptor,
            value: descriptor,
          });
        });
      }

      setAuthorOptions(newAuthorOptions);
      setSubjectOptions(newSubjectOptions);
      setAffOptions(newAffOptions);
      setCourseOptions(newCourseOptions);
      setPubOptions(newPubOptions);
      setCIDOptions(newCIDOptions);
    } catch (err) {
      handleGlobalError(err);
      setLoadedFilters(true);
    } finally {
      setLoadedFilters(true);
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
  //     searchCommonsCatalog();
  //   }
  // }, [checkedParams.current, location.search, activePage, itemsPerPage]);

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
   * Updates the Active Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   */
  function handleActivePageChange(_e: any, data: PaginationProps) {
    if (data.activePage && typeof data.activePage === "number") {
      return setActivePage(data.activePage);
    }
    setActivePage(1);
  }

  const VisualMode = () => {
    if (items.length > 0) {
      return (
        <div className="commons-content-card-grid">
          {items.map((item, index) => (
            <CatalogCard item={item} key={index} />
          ))}
        </div>
      );
    } else {
      return (
        <p className="text-center mt-2e mb-2e">
          <em>No results found.</em>
        </p>
      );
    }
  };

  const ItemizedMode = () => {
    return <CatalogTable items={items} />;
  };

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            {((org.commonsHeader && org.commonsHeader !== "") ||
              (org.commonsMessage && org.commonsMessage !== "")) && (
              <Segment padded>
                <Breakpoint name="desktop">
                  {org.commonsHeader && org.commonsHeader !== "" && (
                    <Header id="commons-intro-header" as="h2">
                      {org.commonsHeader}
                    </Header>
                  )}
                  <p id="commons-intro-message">{org.commonsMessage}</p>
                </Breakpoint>
                <Breakpoint name="mobileOrTablet">
                  {org.commonsHeader && org.commonsHeader !== "" && (
                    <Header
                      id="commons-intro-header"
                      textAlign="center"
                      as="h2"
                    >
                      {org.commonsHeader}
                    </Header>
                  )}
                  <p id="commons-intro-message" className="text-center">
                    {org.commonsMessage}
                  </p>
                </Breakpoint>
              </Segment>
            )}
            <Segment>
              <div id="commons-searchbar-container">
                <Form onSubmit={searchCommonsCatalog}>
                  <Form.Input
                    icon="search"
                    placeholder="Search..."
                    className="color-libreblue"
                    id="commons-search-input"
                    iconPosition="left"
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                    }}
                    fluid
                    value={searchQuery}
                    aria-label="Search query"
                  />
                </Form>
              </div>
              <div id="commons-searchbtns-container">
                <Button
                  fluid
                  id="commons-search-button"
                  onClick={searchCommonsCatalog}
                  style={
                    org.orgID !== "libretexts" && org.primaryColor
                      ? {
                          backgroundColor: sanitizeCustomColor(
                            org.primaryColor
                          ),
                        }
                      : {}
                  }
                  className={
                    org.orgID === "libretexts" || !org.primaryColor
                      ? "commons-search-button-bg"
                      : ""
                  }
                >
                  Search Catalog
                </Button>
                <button
                  id="commons-advancedsrch-button"
                  onClick={() => {
                    setShowFilters(!showFilters);
                  }}
                >
                  <Icon name={showFilters ? "caret down" : "caret right"} />
                  <span>Advanced Search</span>
                  <Icon name={showFilters ? "caret down" : "caret left"} />
                </button>
              </div>
              <div
                id="commons-advancedsrch-container"
                className={
                  showFilters
                    ? "commons-advancedsrch-show"
                    : "commons-advancedsrch-hide"
                }
              >
                <div
                  id="commons-advancedsrch-row1"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Library"
                    floating
                    selection
                    button
                    options={libraryOptions}
                    onChange={(_e, { value }) => {
                      setLibraryFilter(value as string);
                    }}
                    value={libraryFilter}
                    className="commons-filter"
                    aria-label="Library filter"
                  />
                  <Dropdown
                    placeholder="Subject"
                    floating
                    search
                    selection
                    button
                    options={subjectOptions}
                    onChange={(_e, { value }) => {
                      setSubjectFilter(value as string);
                    }}
                    value={subjectFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Author"
                    floating
                    search
                    selection
                    button
                    options={authorOptions}
                    onChange={(_e, { value }) => {
                      setAuthorFilter(value as string);
                    }}
                    value={authorFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                <div
                  id="commons-advancedsrch-row2"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Affiliation"
                    floating
                    search
                    selection
                    button
                    options={affOptions}
                    onChange={(_e, { value }) => {
                      setAffilFilter(value as string);
                    }}
                    value={affilFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="License"
                    floating
                    selection
                    button
                    options={licenseOptions}
                    onChange={(_e, { value }) => {
                      setLicenseFilter(value as string);
                    }}
                    value={licenseFilter}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Instructor/Remixer"
                    floating
                    search
                    selection
                    button
                    options={[]}
                    onChange={(_e, { value }) => {
                      setInstrFilter(value as string);
                    }}
                    value={instrFilter}
                    disabled
                    tabIndex={-1}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                <div
                  id="commons-advancedsrch-row3"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Campus or Course"
                    floating
                    search
                    selection
                    button
                    options={courseOptions}
                    onChange={(_e, { value }) => {
                      setCourseFilter(value as string);
                    }}
                    value={courseFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Publisher"
                    floating
                    search
                    selection
                    button
                    options={pubOptions}
                    onChange={(_e, { value }) => {
                      setPubFilter(value as string);
                    }}
                    value={pubFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="C-ID"
                    floating
                    search
                    selection
                    button
                    options={cidOptions}
                    onChange={(_e, { value }) => setCIDFilter(value as string)}
                    value={cidFilter}
                    tabIndex={-1}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                <div className="flex justify-center mt-2">
                  <Checkbox
                    checked={includeAssets}
                    onChange={(e, data) =>
                      setIncludeAssets(data.checked ?? true)
                    }
                    label="Include Assets"
                  />
                </div>
                {!includeCampus && !includeCentral && (
                  <div
                    id="commons-advancedsrch-row6"
                    className="commons-advancedsrch-row mt-1r"
                  >
                    <p style={{ fontStyle: "italic" }}>
                      No bookshelves selected. All bookshelves will be included
                      by default.
                    </p>
                  </div>
                )}
              </div>
              {initialSearch.current && (
                <p
                  className="underline text-center my-2 cursor-pointer"
                  //onClick={resetSearch}
                >
                  Reset All
                </p>
              )}
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="mt-05p mb-05p flex-row-div">
                  <p className="mr-1p">Search Locations: </p>
                  <Checkbox
                    label="Central Bookshelves"
                    checked={includeCentral}
                    onChange={(e, data) =>
                      setIncludeCentral(data.checked ?? true)
                    }
                  />
                  <Checkbox
                    className="ml-2r"
                    label="Campus Bookshelves"
                    checked={includeCampus}
                    onChange={(e, data) =>
                      setIncludeCampus(data.checked ?? true)
                    }
                  />
                </div>
                <div className="commons-content-pagemenu">
                  <div className="commons-content-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="commons-content-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText resultsCount={numResultItems} totalCount={0} />
                  </div>
                  <div className="commons-content-pagemenu-center">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={handleActivePageChange}
                      size="large"
                      siblingRange={0}
                    />
                  </div>
                  <div className="commons-content-pagemenu-right">
                    <Dropdown
                      placeholder="Sort by..."
                      floating
                      selection
                      button
                      options={sortOptions}
                      onChange={(_e, { value }) => {
                        setSortChoice(value as string);
                      }}
                      value={sortChoice}
                      aria-label="Sort results by"
                    />
                    <Dropdown
                      placeholder="Display mode..."
                      floating
                      selection
                      button
                      options={catalogDisplayOptions}
                      onChange={(_e, { value }) => {
                        setDisplayChoice(value as string);
                      }}
                      value={displayChoice}
                      aria-label="Set results display mode"
                    />
                  </div>
                </div>
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <div className="center-flex flex-wrap">
                        <p className="mr-1p">Search Locations: </p>
                        <div className="mb-2r flex-row-div px-auto">
                          <Checkbox
                            label="Central Bookshelves"
                            checked={includeCentral}
                            onChange={(e, data) =>
                              setIncludeCentral(data.checked ?? true)
                            }
                          />
                          <Checkbox
                            className="ml-2r"
                            label="Campus Bookshelves"
                            checked={includeCampus}
                            onChange={(e, data) =>
                              setIncludeCampus(data.checked ?? true)
                            }
                          />
                        </div>
                        <span>Displaying </span>
                        <Dropdown
                          className="commons-content-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                        <ResultsText
                          resultsCount={numResultItems}
                          totalCount={0}
                        />
                      </div>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <Dropdown
                        placeholder="Display mode..."
                        floating
                        selection
                        button
                        options={catalogDisplayOptions}
                        onChange={(_e, { value }) => {
                          setDisplayChoice(value as string);
                        }}
                        value={displayChoice}
                        fluid
                        aria-label="Set results display mode"
                      />
                      <Dropdown
                        placeholder="Sort by..."
                        floating
                        selection
                        button
                        options={sortOptions}
                        onChange={(_e, { value }) => {
                          setSortChoice(value as string);
                        }}
                        value={sortChoice}
                        fluid
                        className="commons-filter"
                        aria-label="Sort results by"
                      />
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="commons-pagination-mobile-container">
                      <ConductorPagination
                        activePage={activePage}
                        totalPages={totalPages}
                        siblingRange={0}
                        firstItem={null}
                        lastItem={null}
                        onPageChange={handleActivePageChange}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
            <Segment
              className={
                displayChoice === "visual"
                  ? "commons-content"
                  : "commons-content commons-content-itemized"
              }
              loading={!loadedData}
              aria-live="polite"
              aria-busy={!loadedData}
            >
              {displayChoice === "visual" ? <VisualMode /> : <ItemizedMode />}
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="commons-content-pagemenu">
                  <div className="commons-content-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="commons-content-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText resultsCount={numResultItems} totalCount={0} />
                  </div>
                  <div className="commons-content-pagemenu-right">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={handleActivePageChange}
                      size="large"
                      siblingRange={0}
                    />
                  </div>
                </div>
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <div className="center-flex flex-wrap">
                        <span>Displaying </span>
                        <Dropdown
                          className="commons-content-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                        <ResultsText
                          resultsCount={numResultItems}
                          totalCount={0}
                        />
                      </div>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="commons-pagination-mobile-container">
                      <ConductorPagination
                        activePage={activePage}
                        totalPages={totalPages}
                        siblingRange={0}
                        firstItem={null}
                        lastItem={null}
                        onPageChange={handleActivePageChange}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
