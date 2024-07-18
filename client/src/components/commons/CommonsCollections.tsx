import "./Commons.css";
import api from "../../api";
import {
  Breadcrumb,
  Grid,
  Header,
  Segment,
} from "semantic-ui-react";
import Breakpoint from "../util/Breakpoints";
import { checkIsCollection } from "../util/TypeHelpers";
import { CollectionDirectoryPathObj } from "../../types";
import CollectionCard from "../controlpanel/Collections/CollectionCard";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import queryString from "query-string";
import React, {
  useEffect,
  useState,
  ReactElement,
} from "react";
import { SortDirection } from "../../types/Misc";
import { useDispatch } from "react-redux";
import useGlobalError from "../error/ErrorHooks";
import { useLocation } from "react-router-dom";
import { useTypedSelector } from "../../state/hooks";
import { useQuery } from "@tanstack/react-query";

const CommonsCollections = () => {
  const { handleGlobalError } = useGlobalError();
  const dispatch = useDispatch();
  const location = useLocation();
  const org = useTypedSelector((state) => state.org);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [query, setQuery] = useState<string | null>(null);
  const [displayChoice, setDisplayChoice] = useState('visual');
  const CUSTOM_LABEL = org.collectionsDisplayLabel ?? "Collections";
  const [currDirPath, setCurrDirPath] = useState<CollectionDirectoryPathObj[]>([
    {
      collID: "",
      name: "",
    },
  ]);

  const { data: collections, isFetching: collectionsLoading, isSuccess: loadedCollections } = useQuery({
    queryKey: ['collections', sort, sortDirection, limit, page, query],
    queryFn: () => getCollections(),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  async function getCollections() {
    try {
      const collRes = await api.getCommonsCollections({
        limit,
        page,
        query,
        sort,
        sortDirection,
      });
      if (collRes.data.err) {
        throw new Error(collRes.data.errMsg);
      }
      return collRes.data.collections;
    } catch (err) {
      handleGlobalError(err);
    }
    return [];
  }


  /**
   * Update the page title based on Organization information and load collections from server.
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
    let params = queryString.parse(location.search);
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

  /**
   * Updates state with the new collection to bring into view.
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
    if (loadedCollections && collections.length > 0) {
      return (
        <div className="collections-manager-card-grid">
          {collections.map((item, idx) => {
            return (
              <CollectionCard
                key={checkIsCollection(item) ? item.collID : `unknown-${idx}`}
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

  const CollectionsPagination = () => (
      <PaginationWithItemsSelect
          activePage={page}
          itemsPerPage={limit}
          setActivePageFn={setPage}
          setItemsPerPageFn={setLimit}
          totalLength={totalItems}
          totalPages={totalPages}
      />
  );

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            <Segment padded>
              <Breakpoint name="desktop">
                <Header id="commons-intro-header" as="h2">
                  {CUSTOM_LABEL}
                </Header>
                {org.collectionsMessage && (
                  <p id="commons-intro-message">{org.collectionsMessage}</p>
                )}
              </Breakpoint>
              <Breakpoint name="mobile">
                <Header id="commons-intro-header" as="h2" textAlign="center">
                  {CUSTOM_LABEL}
                </Header>
                {org.collectionsMessage && (
                  <p id="commons-intro-message">{org.collectionsMessage}</p>
                )}
              </Breakpoint>
            </Segment>
            {/* Don't display breadcrumbs if at root */}
            {/* TODO: revisit
            {activeCollection && (
              <Segment padded>
                <DirectoryBreadcrumbs />
              </Segment>
            )}
            */}
            <Segment>
              <Breakpoint name="desktop">
                <CollectionsPagination />
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <CollectionsPagination />
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
              loading={collectionsLoading}
            >
              <VisualMode />
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <CollectionsPagination />
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <CollectionsPagination />
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
