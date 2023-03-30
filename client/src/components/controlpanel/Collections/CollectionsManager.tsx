import "../ControlPanel.css";
import "./CollectionsManager.css";

import {
  Grid,
  Header,
  Segment,
  Button,
  Dropdown,
  Icon,
  Input,
  Breadcrumb,
} from "semantic-ui-react";
import { useEffect, useState, useCallback, ReactElement } from "react";
import Breakpoint from "../../util/Breakpoints";
import { Link, useHistory } from "react-router-dom";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks.js";
import {
  Collection,
  CollectionDirectoryPathObj,
  CollectionResource,
} from "../../../types";
import EditCollection from "./EditCollection";
import DeleteCollection from "./DeleteCollection";
import CollectionCard from "./CollectionCard";
import ConductorPagination, {
  ResultsText,
} from "../../util/ConductorPagination";
import { catalogItemsPerPageOptions } from "../../util/PaginationOptions.js";
import { collectionSortOptions } from "../../util/CollectionHelpers";
import {
  checkIsBook,
  checkIsCollection,
  checkIsCollectionResource,
} from "../../util/TypeHelpers";
import AddResources from "./AddResources";

const CollectionsManager = () => {
  // Global State
  const { handleGlobalError } = useGlobalError();
  
  // Data
  const [collections, setCollections] = useState<
    Collection[] | CollectionResource[]
  >([]);
  const [pageColls, setPageColls] = useState<
    Collection[] | CollectionResource[]
  >([]);

  // UI
  const [rootMode, setRootMode] = useState<boolean>(true);
  const [activeCollection, setActiveCollection] = useState<Collection>();
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [loadedData, setLoadedData] = useState<boolean>(false);
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
  const [editCollModalMode, setEditCollModalMode] = useState<
    "create" | "edit" | "nest"
  >("create");

  // Add Resources Modal
  const [showAddResourcesModal, setShowAddResourcesModal] =
    useState<boolean>(false);

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
    if (currDirPath.at(-1)?.collID !== "") {
      searchUrl = `/commons/collection/${currDirPath.at(-1)?.collID}`;
    }
    axios
      .get(searchUrl)
      .then((res) => {
        if (!res.data.err) {
          if (currDirPath.at(-1)?.collID !== "") {
            if (res.data.coll && typeof res.data.coll === "object") {
              setRootMode(false);
              setActiveCollection(res.data.coll);
              setCollections(res.data.coll.resources);
            } else {
              handleGlobalError("Error processing server response");
            }
          } else {
            if (Array.isArray(res.data.colls)) {
              setRootMode(true);
              setCollections(res.data.colls);
            } else {
              handleGlobalError("Error processing server response");
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
  }, [currDirPath, setCollections, setLoadedData, handleGlobalError]);

  /**
   * Set page title and retrieve collections
   * on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Collections Manager";
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
   * Open the Create/Edit Collection Modal in Create mode
   */
  const openCreateCollModal = () => {
    setShowEditCollectionModal(true);
    setEditCollModalMode("create");
    setCollectionToEdit(undefined);
  };

  /**
   * Open the Create/Edit Collection Modal in Edit mode and set all fields
   * to their existing values.
   */
  const openEditCollModal = () => {
    if (rootMode) return;
    setEditCollModalMode("edit");
    setCollectionToEdit(activeCollection);
    setShowEditCollectionModal(true);
  };

  /**
   * Close the Create/Edit Collection Modal and reset all fields to their default values.
   * This is used if the user aborted changes.
   */
  const closeEditCollModal = () => {
    setShowEditCollectionModal(false);
    setEditCollModalMode("create");
    getCollections();
  };

  /**
   * Close the Create/Edit Collection Modal and reset all fields to their default values.
   * This is used if the user saved changes.
   */
  const closeEditCollModalOnSuccess = () => {
    setShowEditCollectionModal(false);
    setEditCollModalMode("create");
    getCollections();
  };

  /**
   * Open the Create/Edit Collection Modal in Nest mode
   */
  const openNestCollModal = () => {
    setShowEditCollectionModal(true);
    setEditCollModalMode("nest");
    setCollectionToEdit(activeCollection);
  };

  /**
   * Open the Add Resources Modal
   */
  const openAddResourcesModal = () => {
    setShowAddResourcesModal(true);
    setCollectionToEdit(activeCollection);
  };

  /**
   * Close Add Resources Modal and reset state where necessary
   */
  const closeAddResourcesModal = () => {
    setShowAddResourcesModal(false);
    getCollections();
  };

  /**
   * Open the Delete Collection Modal and
   * set the Collection to be deleted.
   */
  const openDelCollModal = () => {
    setCollectionToDelete(activeCollection);
    setShowDeleteCollectionModal(true);
  };

  /**
   * Close the Delete Collection Modal
   * and reset Collection to be deleted.
   * This is used if user aborted changes
   */
  const closeDelCollModal = () => {
    setShowDeleteCollectionModal(false);
    setCollectionToDelete(undefined);
  };

  /**
   * Close the Delete Collection Modal and reset all fields to their default values.
   * This is used if the user saved changes.
   */
  const closeDeleteModalOnSuccess = () => {
    setShowDeleteCollectionModal(false);
    setCollectionToDelete(undefined);
    setCurrDirPath([
      {
        collID: "",
        name: "",
      },
    ]);
  };

  /**
   * Updates state with the a new collection to bring into view.
   * @param {string} collectionID - Identifier of the collection entry.
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
    window.open(`/book/${bookID}`, '_blank')
  }

  function handleDeleteItem(item: CollectionResource) {
    if (!checkIsCollectionResource(item)) return;

    let axiosReq;
    if (item.resourceData && checkIsCollection(item.resourceData)) {
      axiosReq = axios.delete(
        `/commons/collection/${item.resourceData.collID}`
      );
    } else {
      axiosReq = axios.delete(
        `/commons/collection/${activeCollection?.collID}/resources/${item.resourceID}`
      );
    }
    axiosReq
      .then((res) => {
        if (!res.data.err) {
          getCollections();
        } else {
          handleGlobalError(res.data.errMsg);
        }
      })
      .catch((err) => {
        handleGlobalError(err);
      });
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
        <Button.Group>
          <Button
            color="red"
            onClick={openDelCollModal}
            aria-label="Delete Collection"
          >
            <Icon name="trash" />
            <Breakpoint name="desktop">Delete Collection</Breakpoint>
          </Button>
          <Button
            color="blue"
            onClick={openEditCollModal}
            aria-label="Edit Collection"
          >
            <Icon name="edit" />
            <Breakpoint name="desktop">Edit Properties</Breakpoint>
          </Button>
          <Button
            color="olive"
            onClick={openNestCollModal}
            aria-label="Add Nested Collection"
          >
            <Icon name="folder open" />
            <Breakpoint name="desktop">Add Nested Collection</Breakpoint>
          </Button>
          <Button
            color="green"
            onClick={openAddResourcesModal}
            aria-label="Add Resource"
          >
            <Icon name="plus" />
            <Breakpoint name="desktop">Add Resource</Breakpoint>
          </Button>
        </Button.Group>
      );
    }
  };

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
        name = "Collections Manager";
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
    if (pageColls.length > 0 && Object.keys(pageColls[0]).length > 0) {
      return (
        <div className="collections-manager-card-grid">
          {pageColls.map((item) => {
            return (
              <CollectionCard
                key={checkIsCollection(item) ? item.collID : item.resourceID}
                item={item}
                onClickCollCB={handleDirectoryClick}
                onClickBookCB={handleBookClick}
                onDeleteCB={handleDeleteItem}
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
    <Grid className="controlpanel-container" divided="vertically" padded>
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Collections Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  <span className="text-link">Control Panel</span>
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
              </Breadcrumb>
              <DirectoryBreadcrumbs />
            </Segment>
            <Segment padded>
              <div className="flex-row-div right-flex">
                <ActionItems />
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
                    <ResultsText
                      resultsCount={collections.length}
                      totalCount={collections.length}
                    />
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
                      <ResultsText
                        resultsCount={collections.length}
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
                        onPageChange={() => setActivePage}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
            <Segment
              className="collections-manager"
              loading={!loadedData}
              aria-live="polite"
              aria-busy={!loadedData}
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
                      resultsCount={collections.length}
                      totalCount={collections.length}
                    />
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
              mode={editCollModalMode}
              collectionToEdit={collectionToEdit}
              onCloseFunc={closeEditCollModal}
              onSuccessFunc={closeEditCollModalOnSuccess}
            />
            <AddResources
              show={showAddResourcesModal}
              onCloseFunc={closeAddResourcesModal}
              collectionToEdit={collectionToEdit}
            />
            <DeleteCollection
              show={showDeleteCollectionModal}
              onCloseFunc={closeDelCollModal}
              onDeleteSuccess={closeDeleteModalOnSuccess}
              collectionToDelete={collectionToDelete}
            />
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CollectionsManager;
