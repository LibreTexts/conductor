import "../ControlPanel.css";
import "./CollectionsManager.css";

import {
  Grid,
  Card,
  Image,
  Header,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown,
  Icon,
  Pagination,
  Input,
  Breadcrumb,
  List,
  Message,
} from "semantic-ui-react";
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactElement,
} from "react";
import Breakpoint from "../../util/Breakpoints";
import { Link } from "react-router-dom";
import axios from "axios";

import { getShelvesNameText } from "../../util/BookHelpers.js";
import {
  isEmptyString,
  basicArraysEqual,
  truncateString,
} from "../../util/HelperFunctions.js";
import useGlobalError from "../../error/ErrorHooks.js";
import {
  Collection,
  CollectionDirectoryPathObj,
  CollectionResource,
  GenericKeyTextValueObj,
  Organization,
} from "../../../types";
import { useTypedSelector } from "../../../state/hooks";
import EditCollection from "./EditCollection";
import DeleteCollection from "./DeleteCollection";
import CollectionCard from "./CollectionCard";
import ConductorPagination, {
  ResultsText,
} from "../../util/ConductorPagination";
import { catalogDisplayOptions } from "../../util/CatalogOptions";
import { catalogItemsPerPageOptions } from "../../util/PaginationOptions.js";
import {
  getLibraryName,
  getLibGlyphURL,
  getLibGlyphAltText,
} from "../../util/LibraryOptions";
import {
  collectionSortOptions,
  collectionPrivacyOptions,
} from "../../util/CollectionHelpers";

const CollectionsManager = () => {
  // Global State
  const { handleGlobalError } = useGlobalError();

  // Data
  const [collections, setCollections] = useState<Collection[]>([]);
  const [displayColls, setDisplayColls] = useState<Collection[]>([]);
  const [pageColls, setPageColls] = useState<Collection[]>([]);

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [searchString, setSearchString] = useState<string>("");
  const [sortChoice, setSortChoice] = useState<string>("title");
  const [displayChoice, setDisplayChoice] = useState<string>("visual");
  const [currDirectory, setCurrDirectory] = useState<string>("");
  const [currDirPath, setCurrDirPath] = useState<CollectionDirectoryPathObj[]>([
    {
      collID: "",
      name: "",
    },
  ]);

  // Edit Collection Modal
  const [showEditCollectionModal, setShowEditCollectionModal] =
    useState<boolean>(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection>();
  const [createMode, setCreateMode] = useState<boolean>(false);

  // Delete Collection Modal
  const [showDeleteCollectionModal, setShowDeleteCollectionModal] =
    useState<boolean>(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection>();

  /**
   * Retrieve all collections via GET request
   * to the server.
   */
  const getCollections = useCallback(() => {
    let searchUrl = "/commons/collections/all";
    if (currDirectory !== "") {
      searchUrl = `/commons/collection/${currDirectory}`;
    }
    axios
      .get(searchUrl)
      .then((res) => {
        if (!res.data.err) {
          console.log(res.data)
          if(currDirectory !== '') {
            if(res.data.coll && typeof res.data.coll === 'object'){
              console.log(res.data.coll.resources)
              setCurrDirPath([...currDirPath, {
                collID: res.data.coll.collID,
                name: res.data.coll.title
              }])
            } else {
              handleGlobalError('Error processing server response')
            }
          }
          else {
            if(Array.isArray(res.data.colls) && res.data.colls.length > 0) {
              setCollections(res.data.colls);
            } else {
              handleGlobalError('Error processing server response')
            }
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
  }, [currDirectory, setCollections, setLoadedData, handleGlobalError]);

  /**
   * Set page title and retrieve collections
   * on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Collections Manager";
    getCollections();
  }, [getCollections, currDirectory]);

  /**
   * Track changes to the number of collections loaded
   * and the selected itemsPerPage and update the
   * set of collections to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(displayColls.length / itemsPerPage));
    setPageColls(
      displayColls.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, displayColls, activePage]);

  /**
   * Filter and sort collections according to
   * user's choices, then update the list.
   */
  useEffect(() => {
    filterAndSortColls();
  }, [collections, searchString, sortChoice]);

  /**
   * Filter and sort collections according
   * to current filters and sort
   * choice.
   */
  const filterAndSortColls = () => {
    setLoadedData(false);
    let filtered = collections.filter((coll) => {
      var include = true;
      var descripString = String(coll.title).toLowerCase();
      if (
        searchString !== "" &&
        String(descripString).indexOf(String(searchString).toLowerCase()) === -1
      ) {
        include = false;
      }
      if (include) {
        return coll;
      } else {
        return false;
      }
    });
    if (sortChoice === "title") {
      const sorted = [...filtered].sort((a, b) => {
        var normalA = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        var normalB = String(b.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        if (normalA < normalB) {
          return -1;
        }
        if (normalA > normalB) {
          return 1;
        }
        return 0;
      });
      setDisplayColls(sorted);
    } else if (sortChoice === "resources") {
      const sorted = [...filtered].sort((a, b) => {
        if (a.resources < b.resources) {
          return -1;
        }
        if (a.resources > b.resources) {
          return 1;
        }
        return 0;
      });
      setDisplayColls(sorted);
    }
    setLoadedData(true);
  };

  /**
   * Open the Create/Edit Collection Modal in Create mode
   */
  const openCreateCollModal = () => {
    setShowEditCollectionModal(true);
    setCreateMode(true);
    setCollectionToEdit(undefined);
  };

  /**
   * Open the Create/Edit Collection Modal in Edit mode and set all fields
   * to their existing values.
   * @param {object} coll - The collection to inspect.
   */
  const openEditCollModal = (coll: Collection) => {
    setCollectionToEdit(coll);
    setShowEditCollectionModal(true);
  };

  /**
   * Close the Create/Edit Collection Modal and reset all fields to their default values.
   */
  const closeEditCollModal = () => {
    setShowEditCollectionModal(false);
    setCollectionToEdit(undefined);
  };

  /**
   * Open the Delete Collection Modal and
   * set the Collection to be deleted.
   * @param {Collection} coll - Collection to be deleted
   */
  const openDelCollModal = (coll: Collection) => {
    setCollectionToDelete(coll);
    setShowDeleteCollectionModal(true);
  };

  /**
   * Close the Delete Collection Modal
   * and reset Collection to be deleted.
   */
  const closeDelCollModal = () => {
    setShowDeleteCollectionModal(true);
    setCollectionToDelete(undefined);
  };

  const performSearch = () => {
    console.log("performing search");
  };

  const resetSearch = () => {
    setSearchString("");
  };

  /**
   * Updates state with the a new collection to bring into view.
   * @param {string} collectionID - Identifier of the collection entry.
   */
  function handleDirectoryClick(collectionID: string) {
    setCurrDirectory(collectionID);
  }

  /**
   * Determines if current directory is root and returns
   * appropriate UI elements
   */
  const ActionItems = () => {
    if (!currDirPath.at(-1)?.collID) {
      return (
        <Button.Group>
          <Button color="green" onClick={openCreateCollModal}>
            <Icon name="plus" />
            New Collection
          </Button>
        </Button.Group>
      );
    } else {
      return (
        <Button.Group fluid>
          <Button color="olive">
            <Icon name="folder open" />
            Nest Collection
          </Button>
          <Button color="green">
            <Icon name="plus" />
            Add Resource
          </Button>
        </Button.Group>
      );
    }
  };

  /**
   * Generates path breadcrumbs based on the current Collection in view.
   * @returns {React.ReactElement} The generated breadcrumbs.
   */
  const DirectoryBreadcrumbs = useMemo(() => {
    const nodes: ReactElement[] = [];
    currDirPath.forEach((item, idx) => {
      let shouldLink = true;
      let name = item.name;
      if (item.name === "" && item.collID === "") {
        nodes.push(
          <>
            <Breadcrumb.Section
              as={Link}
              to="/controlpanel"
              key={"controlpanel"}
            >
              Control Panel
            </Breadcrumb.Section>
            <Breadcrumb.Divider
              icon="right chevron"
              key={"control-panel-divider"}
            />
            <Breadcrumb.Section active key={"collections-manager"}>
              Collections Manager
            </Breadcrumb.Section>
          </>
        );
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
      nodes.push(
        <span
          key={`section-${item.collID}`}
          onClick={
            shouldLink ? () => handleDirectoryClick(item.collID) : undefined
          }
          className={shouldLink ? "text-link" : ""}
        >
          {name}
        </span>
      );
    });
    return <Breadcrumb>{nodes}</Breadcrumb>;
  }, [currDirPath]);

  const MemoizedCollCardList = useMemo(
    () => (
      <div className="collections-manager-card-grid">
        {pageColls.map((item) => {
          return (
            <CollectionCard item={item} onClickCB={handleDirectoryClick} />
          );
        })}
      </div>
    ),
    [pageColls]
  );

  const MemoizedCollItemList = useMemo(
    () => (
      <>
        {pageColls.map((item) => (
          <Table.Row key={item.collID}>
            <Table.Cell></Table.Cell>
            <Table.Cell>
              <p>
                <strong>
                  <Link to={`/collection/${item.collID}`}>{item.title}</Link>
                </strong>
              </p>
            </Table.Cell>
            <Table.Cell>
              <p>{item.title}</p>
            </Table.Cell>
            <Table.Cell>
              <p>{item.program}</p>
            </Table.Cell>
            <Table.Cell>
              <p>
                <em>{item.privacy}</em>
              </p>
            </Table.Cell>
          </Table.Row>
        ))}
      </>
    ),
    [pageColls]
  );

  const VisualMode = () => {
    if (pageColls.length > 0) {
      return MemoizedCollCardList;
    } else {
      return (
        <p className="text-center mt-2e mb-2e">
          <em>No results found.</em>
        </p>
      );
    }
  };

  const ItemizedMode = () => {
    return (
      <Table celled title="Search Results">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell scope="col">
              <Image
                centered
                src={getLibGlyphURL("")}
                className="collections-manager-itemized-glyph"
                alt={getLibGlyphAltText("")}
              />
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Title</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Subject</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Author</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Affiliation</Header>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {pageColls.length > 0 && MemoizedCollItemList}
          {pageColls.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={5}>
                <p className="text-center">
                  <em>No results found.</em>
                </p>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    );
  };

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Collections Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>{DirectoryBreadcrumbs}</Segment>
            <Segment>
              <div className="flex-row-div">
                <div className="left-flex">
                  <Input
                    icon="search"
                    iconPosition="left"
                    placeholder="Search here..."
                    onChange={(e) => {
                      setSearchString(e.target.value);
                    }}
                    value={searchString}
                  />
                </div>
                <div className="right-flex">
                  <ActionItems />
                </div>
              </div>
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
                  </div>
                  <div className="collections-manager-pagemenu-center">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={() => setActivePage}
                      size="large"
                      siblingRange={0}
                    />
                  </div>
                  <div className="collections-manager-pagemenu-right">
                    <Dropdown
                      placeholder="Sort by..."
                      floating
                      selection
                      button
                      options={collectionSortOptions}
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
                        options={collectionSortOptions}
                        onChange={(_e, { value }) => {
                          setSortChoice(value as string);
                        }}
                        value={sortChoice}
                        fluid
                        className="collections-manager-filter"
                        aria-label="Sort results by"
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
                        onPageChange={() => setActivePage}
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
                  ? "collections-manager"
                  : "collections-manager collections-manager-itemized"
              }
              loading={!loadedData}
              aria-live="polite"
              aria-busy={!loadedData}
            >
              {displayChoice === "visual" ? <VisualMode /> : <ItemizedMode />}
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
                    {/* TODO: Results Text */}
                  </div>
                  <div className="collections-manager-pagemenu-right">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={() => setActivePage}
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
                        onPageChange={() => setActivePage}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
            <EditCollection
              show={showEditCollectionModal}
              createMode={createMode}
              collectionToEdit={collectionToEdit}
              onCloseFunc={closeEditCollModal}
            />
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CollectionsManager;
