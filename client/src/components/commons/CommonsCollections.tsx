import "./Commons.css";

import {
  Grid,
  Segment,
  Header,
  Card,
  Image,
  Dropdown,
  Table,
  Breadcrumb,
  PaginationProps,
} from "semantic-ui-react";
import React, {
  useEffect,
  useState,
  useMemo,
  ReactElement,
  useCallback,
} from "react";
import ConductorPagination, { ResultsText } from "../util/ConductorPagination";
import { Link } from "react-router-dom";
import { useLocation, useHistory } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import queryString from "query-string";

import Breakpoint from "../util/Breakpoints";
import useGlobalError from "../error/ErrorHooks.js";
import { catalogDisplayOptions } from "../util/CatalogOptions";
import { catalogItemsPerPageOptions } from "../util/PaginationOptions";
import { updateParams } from "../util/HelperFunctions.js";
import { useTypedSelector } from "../../state/hooks";
import CollectionCard from "../controlpanel/Collections/CollectionCard";
import {
  Collection,
  CollectionResource,
  CollectionDirectoryPathObj,
} from "../../types";
import {
  checkIsCollection,
  checkIsCollectionResource,
} from "../util/TypeHelpers";

const CommonsCollections = () => {
  const { handleGlobalError } = useGlobalError();

  // Global State and Location/History
  const dispatch = useDispatch();
  const location = useLocation();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);
  const CUSTOM_LABEL = org.collectionsDisplayLabel ?? "Collections";

  // UI
  const displayChoice = useTypedSelector(
    (state) => state.filters.collections.mode
  );
  const [activePage, setActivePage] = useState<number>(1);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [currDirPath, setCurrDirPath] = useState<CollectionDirectoryPathObj[]>([
    {
      collID: "",
      name: "",
    },
  ]);

  // Data
  const [collections, setCollections] = useState<
    Collection[] | CollectionResource[]
  >([]);
  const [pageColls, setPageColls] = useState<
    Collection[] | CollectionResource[]
  >([]);
  const [activeCollection, setActiveCollection] = useState<Collection>();

  /**
   * Update the page title based on
   * Organization information and load collections from server.
   */
  useEffect(() => {
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | ${CUSTOM_LABEL}`;
    } else {
      document.title = `LibreCommons | Collections`;
    }
  }, [org]);

  /**
   * Subscribe to changes in the URL search string
   * and update state accordingly.
   */
  useEffect(() => {
    var params = queryString.parse(location.search);
    if (params.mode && params.mode !== displayChoice) {
      if (params.mode === "visual" || params.mode === "itemized") {
        dispatch({
          type: "SET_COLLECTIONS_MODE",
          payload: params.mode,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const getCollections = useCallback(() => {
    let searchUrl = "/commons/collections";
    if (currDirPath.at(-1)?.collID !== "") {
      searchUrl = `/commons/collection/${currDirPath.at(-1)?.collID}`;
    }
    axios
      .get(searchUrl)
      .then((res) => {
        if (!res.data.err) {
          if (currDirPath.at(-1)?.collID !== "") {
            if (res.data.coll && typeof res.data.coll === "object") {
              setActiveCollection(res.data.coll);
              setCollections(res.data.coll.resources);
            } else {
              handleGlobalError("Error processing server response");
            }
          } else {
            if (Array.isArray(res.data.colls)) {
              setCollections(res.data.colls);
            } else {
              handleGlobalError("Error processing server response");
            }
          }

          if (
            res.data.colls &&
            Array.isArray(res.data.colls) &&
            res.data.colls.length > 0
          ) {
            setCollections(res.data.colls);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedData(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedData(true);
      });
  }, [currDirPath, setCollections, setLoadedData, handleGlobalError]);

  /**
   * Load collections from server.
   */
  useEffect(() => {
    getCollections();
  }, [getCollections, currDirPath]);

  /**
   * Track changes to the number of collections loaded
   * and the selected itemsPerPage and update the
   * set of collections to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(collections.length / itemsPerPage));
    setPageColls(
      collections.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, collections, activePage]);

  /**
   * Updates state with the a new collection to bring into view.
   * @param {string} collectionID - Identifier of the collection entry.
   * @param {string} collName - Title of the collection entry
   */
  function handleDirectoryClick(collectionID: string, collName: string) {
    const existingItem = currDirPath.findIndex(
      (path) => path.collID === collectionID
    );

    if (existingItem > -1) {
      setCurrDirPath([...currDirPath.slice(0, existingItem + 1)]);
    } else {
      setCurrDirPath([
        ...currDirPath,
        { collID: collectionID, name: collName },
      ]);
    }
  }

  /**
   * Navigates user to the Commons entry for the book
   * @param {string} bookID - Identifier of the book
   */
  function handleBookClick(bookID: string) {
    window.open(`/book/${bookID}`, "_blank");
  }

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

  /**
   * Generates path breadcrumbs based on the current Collection in view.
   * @returns {React.ReactElement} The generated breadcrumbs.
   */
  function DirectoryBreadcrumbs() {
    const nodes: ReactElement[] = [];
    currDirPath.forEach((item, idx) => {
      let shouldLink = true;
      let name = item.name;
      if (item.name === "" && item.collID === "") {
        name = `${CUSTOM_LABEL}`;
      } else {
        nodes.push(
          <Breadcrumb.Divider
            key={`divider-${item.collID}`}
            icon="right chevron"
          />
        );
      }
      if (idx === currDirPath.length - 1) {
        shouldLink = false; // don't click active directory
      }
      const foundExisting = nodes.find((value) => {
        value.key == `section-${item.collID}`; // don't add additional breadcrumb if it already exists/is active
      });
      if (!foundExisting) {
        nodes.push(
          <span
            key={`section-${item.collID}`}
            onClick={
              shouldLink
                ? () => handleDirectoryClick(item.collID, item.name)
                : undefined
            }
            className={shouldLink ? "text-link" : ""}
          >
            {name}
          </span>
        );
      }
    });
    return <Breadcrumb>{nodes}</Breadcrumb>;
  }

  const VisualMode = () => {
    if (pageColls.length > 0 && Object.keys(pageColls[0]).length > 1) {
      return (
        <div className="collections-manager-card-grid">
          {pageColls.map((item) => {
            return (
              <CollectionCard
                key={checkIsCollection(item) ? item.collID : item.resourceID}
                item={item}
                onClickBookCB={handleBookClick}
                onClickCollCB={handleDirectoryClick}
              />
            );
          })}
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

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            <Segment>
              <Breakpoint name="desktop">
                <div className="commons-content-pagemenu">
                  <div className="commons-content-pagemenu-left">
                    <Header as="h2">{CUSTOM_LABEL}</Header>
                  </div>
                </div>
              </Breakpoint>
              <Breakpoint name="mobile">
                <Grid>
                  <Grid.Row>
                    <Grid.Column>
                      <Header as="h2" textAlign="center">
                        {CUSTOM_LABEL}
                      </Header>
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
            <Segment>
              <DirectoryBreadcrumbs />
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="collections-manager-pagemenu">
                  <div className="collections-manager-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="collections-manager-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText
                      resultsCount={pageColls.length}
                      totalCount={collections.length}
                    />
                  </div>
                  <div className="collections-manager-pagemenu-right">
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
                          className="collections-manager-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                      </div>
                      <ResultsText
                        resultsCount={pageColls.length}
                        totalCount={collections.length}
                      />
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="collections-manager-pagination-mobile-container">
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
            >
              <VisualMode />
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="collections-manager-pagemenu">
                  <div className="collections-manager-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="collections-manager-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText
                      resultsCount={pageColls.length}
                      totalCount={collections.length}
                    />
                  </div>
                  <div className="collections-manager-pagemenu-right">
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
                          className="collections-manager-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                        <ResultsText
                          resultsCount={pageColls.length}
                          totalCount={collections.length}
                        />
                      </div>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="collections-manager-pagination-mobile-container">
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

export default CommonsCollections;
