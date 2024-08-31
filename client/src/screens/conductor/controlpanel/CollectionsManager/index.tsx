import "../../../../components/controlpanel/ControlPanel.css";
import "../../../../components/controlpanel/Collections/collections.css";

import {
    Grid,
    Header,
    Segment,
    Button,
    Dropdown,
    Icon,
    Breadcrumb,
} from "semantic-ui-react";
import { useEffect, useState, ReactElement, useMemo } from "react";
import Breakpoint from "../../../../components/util/Breakpoints";
import { Link } from "react-router-dom";
import useGlobalError from "../../../../components/error/ErrorHooks";
import {
    Collection,
    CollectionDirectoryPathObj,
    CollectionResource,
} from "../../../../types"
import AddResources from "../../../../components/controlpanel/Collections/AddResources";
import EditCollection from "../../../../components/controlpanel/Collections/EditCollection";
import DeleteCollection from "../../../../components/controlpanel/Collections/DeleteCollection";
import CollectionCard from "../../../../components/controlpanel/Collections/CollectionCard";
import ConductorPagination, {
    ResultsText,
} from "../../../../components/util/ConductorPagination";
import { catalogItemsPerPageOptions } from "../../../../components/util/PaginationOptions.js";
import { checkIsCollection, checkIsCollectionResource } from "../../../../components/util/TypeHelpers";
import { useTypedSelector } from "../../../../state/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { useModals } from "../../../../context/ModalContext";
import DOMPurify from "dompurify";
import { marked } from "marked";

type AllCollectionsResponse = {
    collections: Collection[];
    total_items: number;
};

const CollectionsManager = () => {
    // Global State
    const { handleGlobalError } = useGlobalError();
    const org = useTypedSelector((state) => state.org);
    const { openModal, closeAllModals } = useModals();
    const queryClient = useQueryClient();

    useEffect(() => {
        document.title = "LibreTexts Conductor | Collections Manager";
    }, []);

    // UI
    const [page, setPage] = useState<number>(1);
    const [resourcesPage, setResourcesPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(12);
    const [currDirectory, setCurrDirectory] = useState<string>("");
    const [currDirPath, setCurrDirPath] = useState<CollectionDirectoryPathObj[]>([
        {
            collID: "",
            name: "",
        },
    ]);

    const rootMode = useMemo(() => currDirPath.length === 1 && currDirPath[0].collID === "", [currDirPath]);

    const ALL_COLL_QUERY_KEY = ["all-collections", currDirectory, page, itemsPerPage];
    const { data, isFetching: loading } = useQuery<AllCollectionsResponse>({
        queryKey: ALL_COLL_QUERY_KEY,
        queryFn: getAllCollections,
    });

    const COLL_QUERY_KEY = ["active-collection", currDirectory, resourcesPage, itemsPerPage];
    const { data: activeCollection, isFetching: loadingActiveColl } = useQuery<Collection | undefined>({
        queryKey: COLL_QUERY_KEY,
        queryFn: () => getCollection(currDirectory),
        enabled: !!currDirectory,
    });

    async function getAllCollections(): Promise<AllCollectionsResponse> {
        try {
            const res = await api.getAllCollections({
                page,
                limit: itemsPerPage
            });
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }

            return {
                collections: res.data.collections || [],
                total_items: res.data.total_items || 0
            }
        } catch (err) {
            handleGlobalError(err);
            return {
                collections: [],
                total_items: 0
            }
        }
    }

    async function getCollection(collID: string): Promise<Collection | undefined> {
        try {
            const promises = [api.getCollection(collID), api.getCollectionResources({
                collIDOrTitle: collID,
                page: resourcesPage,
                limit: itemsPerPage,
            })];
            const results = await Promise.all(promises);

            const collection = results[0];
            const resources = results[1];

            if (collection.data.err || resources.data.err) {
                throw new Error('Error fetching collection data');
            }

            // @ts-ignore
            const collData = collection.data.collection as Collection
            // @ts-ignore            
            const resData = resources.data.resources as CollectionResource[]
            // @ts-ignore
            const totalItems = resources.data.total_items || 0;


            return {
                ...collData,
                resources: resData,
                resourceCount: totalItems
            }
        } catch (err) {
            handleGlobalError(err);
            return undefined
        }
    }

    const openCollModal = (mode: 'create' | 'edit' | 'nest', coll?: Collection) => {
        if (rootMode && mode !== 'create') return;
        openModal(
            <EditCollection
                show={true}
                mode={mode}
                collectionToEdit={coll}
                onCloseFunc={closeAllModals}
                onSuccessFunc={() => {
                    closeAllModals();
                    queryClient.invalidateQueries(ALL_COLL_QUERY_KEY);
                    queryClient.invalidateQueries(["active-collection", currDirectory]);
                }}
            />
        )
    };

    const openAddResourcesModal = (coll?: Collection) => {
        if (!coll) return;
        openModal(
            <AddResources
                show={true}
                onCloseFunc={() => {
                    closeAllModals();
                    queryClient.invalidateQueries(["active-collection", currDirectory]);
                }}
                collectionToEdit={coll}
            />
        )
    };

    const openDelCollModal = (coll?: Collection) => {
        if (!coll) return;
        openModal(
            <DeleteCollection
                show={true}
                onCloseFunc={closeAllModals}
                onDeleteSuccess={() => {
                    closeAllModals();
                    setCurrDirPath([
                        {
                            collID: "",
                            name: "",
                        }
                    ])
                }}
                collectionToDelete={coll}
            />
        )
    };

    /**
     * Updates state with the a new collection to bring into view.
     * @param {string} collectionID - Identifier of the collection entry.
     */
    function handleDirectoryClick(collectionID: string, collName: string) {
        setCurrDirectory(collectionID);
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

    function handleBookClick(bookID: string) {
        window.open(`/book/${bookID}`, "_blank");
    }


    const deleteItemMutation = useMutation<Collection, Error, { item: CollectionResource }>({
        mutationFn: ({ item }: { item: CollectionResource }) => _handleDeleteItem(item),
        onError(err) {
            handleGlobalError(err);
        },
        onSuccess(data) {
            queryClient.setQueryData(COLL_QUERY_KEY, data);
        },
    })


    async function _handleDeleteItem(item: CollectionResource): Promise<Collection> {
        if (!checkIsCollectionResource(item)) {
            throw new Error('Invalid item type');
        }

        if (!activeCollection) {
            throw new Error('No active collection');
        }

        const res = await api.deleteCollectionResource(activeCollection.collID, item.resourceID);
        if (res.data.err) {
            throw new Error(res.data.errMsg);
        }

        const updatedResources = activeCollection?.resources.filter((res) => res.resourceID !== item.resourceID) || [];

        return {
            ...activeCollection,
            resources: updatedResources
        }

    }

    /**
     * Determines if current directory is root and returns
     * appropriate UI elements
     */
    const ActionItems = () => {
        if (!currDirPath.at(-1)?.collID) {
            return (
                <Button.Group>
                    <Button color="green" onClick={() => openCollModal('create')}>
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
                        onClick={() => openDelCollModal(activeCollection)}
                        aria-label="Delete Collection"
                    >
                        <Icon name="trash" />
                        <Breakpoint name="desktop">Delete Collection</Breakpoint>
                    </Button>
                    <Button
                        color="blue"
                        onClick={() => openCollModal('edit', activeCollection)}
                        aria-label="Edit Collection"
                    >
                        <Icon name="edit" />
                        <Breakpoint name="desktop">Edit Properties</Breakpoint>
                    </Button>
                    <Button
                        color="olive"
                        onClick={() => openCollModal('nest', activeCollection)}
                        aria-label="Add Nested Collection"
                    >
                        <Icon name="folder open" />
                        <Breakpoint name="desktop">Add Nested Collection</Breakpoint>
                    </Button>
                    <Button
                        color="green"
                        onClick={() => openAddResourcesModal(activeCollection)}
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

    const VisualMode = ({ data }: { data?: Collection[] | CollectionResource[] }) => {
        if (data && data.length > 0 && Object.keys(data[0]).length > 0) {
            return (
                <div className="collections-manager-card-grid">
                    {data.map((item) => {
                        return (
                            <CollectionCard
                                key={checkIsCollection(item) ? item.collID : item.resourceID}
                                item={item}
                                onClickCollCB={handleDirectoryClick}
                                onClickBookCB={handleBookClick}
                                onDeleteCB={async (item) => {
                                    await deleteItemMutation.mutateAsync({ item });
                                }}
                                asLink={false}
                                className="cursor-pointer"
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

    const calcTotalPages = (rootMode: boolean) => {
        if (rootMode) {
            if (!data) return 1;
            return Math.ceil(data?.total_items / itemsPerPage);
        }
        if (!activeCollection || !activeCollection.resourceCount) return 1;
        return Math.ceil(activeCollection?.resourceCount / itemsPerPage);
    }

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
                            <div className="flex-row-div">
                                <div className="left-flex">
                                    {org.collectionsDisplayLabel && (
                                        <span>
                                            These collections will appear as{" "}
                                            <strong className="text-bold">
                                                {org.collectionsDisplayLabel}
                                            </strong>{" "}
                                            in your Campus Commons. You can change this label in{" "}
                                            <a href="/controlpanel/campussettings" target="_blank">
                                                Campus Settings
                                            </a>
                                            .
                                        </span>
                                    )}
                                </div>
                                <div className="right-flex">
                                    <ActionItems />
                                </div>
                            </div>
                        </Segment>
                        {
                            !rootMode && activeCollection && (
                                <Segment padded>
                                    {
                                        activeCollection.description && (
                                            <p
                                                className='text-base text-center lg:text-left prose prose-code:before:hidden prose-code:after:hidden max-w-full'
                                                dangerouslySetInnerHTML={{
                                                    __html: DOMPurify.sanitize(marked(activeCollection.description, { breaks: true }))
                                                }}
                                            />
                                        )
                                    }
                                    {
                                        !activeCollection.description && (
                                            <p>
                                                <em>No collection description yet.</em>
                                            </p>
                                        )
                                    }
                                </Segment>
                            )
                        }
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
                                            resultsCount={rootMode ? data?.collections.length || 0 : activeCollection?.resourceCount || 0}
                                            totalCount={rootMode ? data?.total_items || 0 : activeCollection?.resourceCount || 0}
                                        />
                                    </div>
                                    <div className="collections-manager-pagemenu-right">
                                        <ConductorPagination
                                            activePage={rootMode ? page : resourcesPage}
                                            totalPages={calcTotalPages(rootMode)}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, { activePage }) => {
                                                if (rootMode) {
                                                    setPage(activePage as number);
                                                } else {
                                                    setResourcesPage(activePage as number);
                                                }
                                            }}
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
                                                resultsCount={rootMode ? data?.collections.length || 0 : activeCollection?.resourceCount || 0}
                                                totalCount={rootMode ? data?.total_items || 0 : activeCollection?.resourceCount || 0}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className="collections-manager-pagination-mobile-container">
                                            <ConductorPagination
                                                activePage={rootMode ? page : resourcesPage}
                                                totalPages={calcTotalPages(rootMode)}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, { activePage }) => {
                                                    if (rootMode) {
                                                        setPage(activePage as number);
                                                    } else {
                                                        setResourcesPage(activePage as number);
                                                    }
                                                }}
                                                size="mini"
                                                siblingRange={0}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment
                            className="collections-manager"
                            loading={loading}
                            aria-live="polite"
                            aria-busy={loading}
                        >
                            <VisualMode data={rootMode ? data?.collections : activeCollection?.resources} />
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
                                            resultsCount={rootMode ? data?.collections.length || 0 : activeCollection?.resourceCount || 0}
                                            totalCount={rootMode ? data?.total_items || 0 : activeCollection?.resourceCount || 0}
                                        />
                                    </div>
                                    <div className="collections-manager-pagemenu-right">
                                        <ConductorPagination
                                            activePage={rootMode ? page : resourcesPage}
                                            totalPages={calcTotalPages(rootMode)}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, { activePage }) => {
                                                if (rootMode) {
                                                    setPage(activePage as number);
                                                } else {
                                                    setResourcesPage(activePage as number);
                                                }
                                            }}
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
                                                    resultsCount={rootMode ? data?.collections.length || 0 : activeCollection?.resourceCount || 0}
                                                    totalCount={rootMode ? data?.total_items || 0 : activeCollection?.resourceCount || 0}
                                                />
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className="collections-manager-pagination-mobile-container">
                                            <ConductorPagination
                                                activePage={rootMode ? page : resourcesPage}
                                                totalPages={calcTotalPages(rootMode)}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, { activePage }) => {
                                                    if (rootMode) {
                                                        setPage(activePage as number);
                                                    } else {
                                                        setResourcesPage(activePage as number);
                                                    }
                                                }}
                                                size="mini"
                                                siblingRange={0}
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

export default CollectionsManager;
