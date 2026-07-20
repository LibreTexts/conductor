import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import {
    Alert,
    Breadcrumb,
    Button,
    Heading,
    IconButton,
    Skeleton,
    Stack,
    Text,
} from "@libretexts/davis-react";
import {
    IconChevronRight,
    IconEdit,
    IconFolderPlus,
    IconTrash,
} from "@tabler/icons-react";
import axios from "axios";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useGlobalError from "../../../../components/error/ErrorHooks";
import {
    Book,
    Collection,
    CollectionDirectoryPathObj,
    CollectionResource,
    CollectionResourceType,
} from "../../../../types";
import api from "../../../../api";
import { useModals } from "../../../../context/ModalContext";
import { useNotifications } from "../../../../context/NotificationContext";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import useMasterCatalogV2 from "../../../../hooks/useMasterCatalogV2";
import CatalogTransferList from "../../../../components/NextGenComponents/CatalogTransferList";
import EditCollection from "../../../../components/controlpanel/Collections/EditCollection";
import DeleteCollection from "../../../../components/controlpanel/Collections/DeleteCollection";
import { getLicenseText } from "../../../../components/util/LicenseOptions.js";
import { truncateString } from "../../../../components/util/HelperFunctions";

const ROOT_PATH = "/controlpanel/collectionsmanager";

/**
 * Dedicated management page for a single collection. Books are managed with a
 * transfer list (available master-catalog books on the left, books in the
 * collection on the right); nested collections are listed separately, each
 * linking to its own detail page.
 */
const CollectionDetail = () => {
    const { collID } = useParams<{ collID: string }>();
    const history = useHistory();
    const { handleGlobalError } = useGlobalError();
    const { openModal, closeAllModals } = useModals();
    const { addNotification } = useNotifications();
    const queryClient = useQueryClient();

    const COLLECTION_KEY = ["collection", collID];
    const RESOURCES_KEY = ["collection-resources", collID];

    // Tracks which collection's resources have been seeded into the transfer
    // list's selected side. React Router keeps this component mounted across
    // `:collID` changes, so seeding is keyed by collID and re-runs on
    // navigation rather than only once per mount.
    const initializedFor = useRef<string | null>(null);
    const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);

    const { data: masterCatalog } = useMasterCatalogV2();

    const {
        data: collection,
        isLoading: collectionLoading,
        isError: collectionError,
    } = useQuery<Collection | undefined>({
        queryKey: COLLECTION_KEY,
        queryFn: getCollection,
        enabled: !!collID,
    });

    const { data: resources } = useQuery<CollectionResource[]>({
        queryKey: RESOURCES_KEY,
        queryFn: getResources,
        enabled: !!collID,
    });

    // Walk the parentID chain to build the ancestor breadcrumb trail. Nesting
    // is shallow and each lookup is React-Query cached, so refreshes on a deep
    // page reconstruct the full trail without relying on navigation state.
    const { data: ancestors } = useQuery<CollectionDirectoryPathObj[]>({
        queryKey: ["collection-ancestors", collID, collection?.parentID],
        enabled: !!collection,
        queryFn: async () => {
            const trail: CollectionDirectoryPathObj[] = [];
            let parentID = collection?.parentID;
            let guard = 0;
            while (parentID && guard < 25) {
                const res = await api.getCollection(parentID);
                const parent = res.data?.collection;
                if (!parent) break;
                trail.unshift({ collID: parent.collID, name: parent.title });
                parentID = parent.parentID;
                guard += 1;
            }
            return trail;
        },
    });

    useDocumentTitle(
        collection ? `${collection.title} | Collections Manager` : "Collections Manager"
    );

    async function getCollection(): Promise<Collection | undefined> {
        try {
            const res = await api.getCollection(collID);
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }
            return res.data.collection;
        } catch (err) {
            handleGlobalError(err);
            return undefined;
        }
    }

    async function getResources(): Promise<CollectionResource[]> {
        try {
            const res = await api.getCollectionResources({
                collIDOrTitle: collID,
                page: 1,
                limit: 1000,
            });
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }
            return res.data.resources || [];
        } catch (err) {
            handleGlobalError(err);
            return [];
        }
    }

    const bookResources = useMemo(
        () =>
            (resources || []).filter(
                (r) => r.resourceType === CollectionResourceType.RESOURCE
            ),
        [resources]
    );

    const nestedCollections = useMemo(
        () =>
            (resources || []).filter(
                (r) => r.resourceType === CollectionResourceType.COLLECTION
            ),
        [resources]
    );

    // Clear the previous selection the moment we navigate to a different
    // collection so the right pane never shows the prior collection's books
    // while the new resources load.
    useEffect(() => {
        initializedFor.current = null;
        setSelectedBooks([]);
    }, [collID]);

    // Seed selected books from the collection's current book resources, once
    // per collection (re-seeds after navigating to a different collID).
    useEffect(() => {
        if (initializedFor.current === collID || !resources) return;
        setSelectedBooks(
            bookResources.map((r) => r.resourceData as Book).filter(Boolean)
        );
        initializedFor.current = collID;
    }, [collID, resources, bookResources]);

    const saveMutation = useMutation<
        void,
        Error,
        { added: string[]; removed: string[] }
    >({
        mutationFn: async ({ added, removed }) => {
            await Promise.all([
                ...(added.length
                    ? [
                        axios.post(`/commons/collection/${collID}/resources`, {
                            books: added,
                        }),
                    ]
                    : []),
                ...removed.map((bookID) =>
                    api.deleteCollectionResource(collID, bookID)
                ),
            ]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(RESOURCES_KEY);
            addNotification({ type: "success", message: "Changes saved." });
        },
        onError: (err) => handleGlobalError(err),
    });

    /**
     * Diffs the incoming selection against local state and persists the change
     * immediately (live save), mirroring BooksManager.
     */
    function handleSelectedBooksChange(newBooks: Book[]) {
        if (initializedFor.current !== collID) return;
        const prevIDs = new Set(selectedBooks.map((b) => b.bookID));
        const newIDs = new Set(newBooks.map((b) => b.bookID));
        const added = newBooks
            .filter((b) => !prevIDs.has(b.bookID))
            .map((b) => b.bookID);
        const removed = selectedBooks
            .filter((b) => !newIDs.has(b.bookID))
            .map((b) => b.bookID);
        setSelectedBooks(newBooks);
        if (added.length || removed.length) {
            saveMutation.mutate({ added, removed });
        }
    }

    function invalidateAll() {
        queryClient.invalidateQueries(COLLECTION_KEY);
        queryClient.invalidateQueries(RESOURCES_KEY);
        queryClient.invalidateQueries(["all-collections"]);
    }

    function openEditModal() {
        openModal(
            <EditCollection
                show={true}
                mode="edit"
                collectionToEdit={collection}
                onCloseFunc={closeAllModals}
                onSuccessFunc={() => {
                    closeAllModals();
                    invalidateAll();
                }}
            />
        );
    }

    function openNestModal() {
        openModal(
            <EditCollection
                show={true}
                mode="nest"
                collectionToEdit={collection}
                onCloseFunc={closeAllModals}
                onSuccessFunc={() => {
                    closeAllModals();
                    invalidateAll();
                }}
            />
        );
    }

    function openDeleteModal() {
        openModal(
            <DeleteCollection
                show={true}
                collectionToDelete={collection}
                onCloseFunc={closeAllModals}
                onDeleteSuccess={() => {
                    closeAllModals();
                    queryClient.invalidateQueries(["all-collections"]);
                    history.push(
                        collection?.parentID
                            ? `${ROOT_PATH}/${collection.parentID}`
                            : ROOT_PATH
                    );
                }}
            />
        );
    }

    function openDeleteNestedModal(child: Collection) {
        openModal(
            <DeleteCollection
                show={true}
                collectionToDelete={child}
                onCloseFunc={closeAllModals}
                onDeleteSuccess={() => {
                    closeAllModals();
                    invalidateAll();
                }}
            />
        );
    }

    if (collectionLoading) {
        return (
            <div className="bg-white h-full px-8 pt-8">
                <Skeleton variant="rounded" height={40} className="mb-4 max-w-md" />
                <Skeleton variant="rounded" height={200} />
            </div>
        );
    }

    if (collectionError || !collection) {
        return (
            <div className="bg-white h-full px-8 pt-8">
                <Heading level={2}>Collection not found</Heading>
                <Text as="p" className="mt-2">
                    We couldn't load this collection.{" "}
                    <Link to={ROOT_PATH} className="text-primary hover:underline">
                        Return to Collections Manager
                    </Link>
                    .
                </Text>
            </div>
        );
    }

    return (
        <div className="px-8">
            <Stack direction="horizontal" gap="md" align="start" justify="between" className="my-8">
                <Stack direction="vertical" gap="sm">
                    <Heading level={1}>
                        {truncateString(collection.title, 60)}
                    </Heading>
                    <Breadcrumb aria-label="Collections navigation">
                        <Breadcrumb.Item>
                            <Link
                                to="/controlpanel"
                                className="text-primary hover:underline"
                            >
                                Control Panel
                            </Link>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item>
                            <Link to={ROOT_PATH} className="text-primary hover:underline">
                                Collections Manager
                            </Link>
                        </Breadcrumb.Item>
                        {(ancestors || []).map((a) => (
                            <Breadcrumb.Item key={`crumb-${a.collID}`}>
                                <Link
                                    to={`${ROOT_PATH}/${a.collID}`}
                                    className="text-primary hover:underline"
                                >
                                    {a.name}
                                </Link>
                            </Breadcrumb.Item>
                        ))}
                        <Breadcrumb.Item isCurrent>{collection.title}</Breadcrumb.Item>
                    </Breadcrumb>
                </Stack>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col-reverse md:flex-row gap-2 flex-wrap">
                        <Button
                            variant="destructive"
                            icon={<IconTrash size={16} />}
                            onClick={openDeleteModal}
                            aria-label="Delete Collection"
                        >
                            Delete Collection
                        </Button>
                    </div>
                </div>
            </Stack>
            <section
                aria-label="Collection properties"
                className="border border-gray-200 rounded-lg p-4 mb-6 bg-white"
            >
                <Stack direction="vertical" gap="sm">
                    <Stack direction="horizontal" gap="md" align="center" justify="between" className="mb-2">
                    <Heading level={3} className="mb-0!">Properties</Heading>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<IconEdit size={16} />}
                        onClick={openEditModal}
                    >
                        Edit Properties
                    </Button>
                </Stack>
                    {collection.description ? (
                        <Text className=""><span className="font-semibold">Description:</span>
                            <span
                                className="text-base prose prose-code:before:hidden prose-code:after:hidden max-w-full"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(
                                        marked(collection.description, { breaks: true })
                                    ),
                                }}
                            />
                        </Text>
                    ) : (
                        <Text as="p">
                            No collection description yet. Add one by clicking "Edit Properties" above.
                        </Text>
                    )}
                    <Text className="capitalize"><span className="font-semibold">Privacy:</span> {collection.privacy}</Text>
                    <Text className="capitalize"><span className="font-semibold">Cover Photo:</span> {collection.coverPhoto ? "Yes" : "No"}</Text>
                </Stack>
            </section>

            {/* Nested collections */}
            <section
                aria-label="Nested collections"
                className="border border-gray-200 rounded-lg p-4 mb-6 bg-white"
            >
                <Stack direction="horizontal" gap="md" align="center" justify="between" className="mb-3">
                    <Heading level={3} className="mb-0!">Nested Collections</Heading>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={<IconFolderPlus size={16} />}
                        onClick={openNestModal}
                    >
                        Add Nested Collection
                    </Button>
                </Stack>
                {nestedCollections.length > 0 ? (
                    <ul role="list" className="list-none m-0 p-0 divide-y divide-gray-100">
                        {nestedCollections.map((r) => {
                            const child = r.resourceData as Collection;
                            return (
                                <li
                                    key={r.resourceID}
                                    className="flex items-center justify-between gap-3 py-2"
                                >
                                    <Link
                                        to={`${ROOT_PATH}/${r.resourceID}`}
                                        className="flex items-center gap-2 text-primary hover:underline font-medium"
                                    >
                                        <IconChevronRight size={16} aria-hidden="true" />
                                        {child?.title || r.resourceID}
                                    </Link>
                                    <div className="flex items-center gap-3">
                                        <Text as="span" color="muted">
                                            {child?.resources?.length ??
                                                child?.resourceCount ??
                                                0}{" "}
                                            resources
                                        </Text>
                                        <IconButton
                                            icon={<IconTrash size={16} />}
                                            aria-label={`Delete nested collection ${child?.title || r.resourceID
                                                }`}
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => openDeleteNestedModal(child)}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </section>

            {/* Books */}
            <section
                aria-label="Books in collection"
                className={`border border-gray-200 rounded-lg p-4 mb-8 bg-white ${collection.autoManage ? '' : 'min-h-[500px]!'}`}
            >
                <Heading level={3} className="mb-3">
                    Books
                </Heading>
                {collection.autoManage ? (
                    <Alert
                        variant="info"
                        message="This collection is managed automatically based on its program and locations. Manual changes to its books are disabled."
                    />
                ) : (
                    <CatalogTransferList
                        availableData={masterCatalog || { libraries: [] }}
                        selectedBooks={selectedBooks}
                        onSelectedBooksChange={handleSelectedBooksChange}
                        selectedTitle={`${collection.title} Resources`}
                        transferDisabled={
                            collection.autoManage || initializedFor.current !== collID
                        }
                        renderBook={(item) => (
                            <div className="flex flex-col gap-y-1">
                                <p className="font-medium text-gray-900">
                                    {item.title} ({item.bookID})
                                </p>
                                <p className="text-sm tracking-wide">
                                    {item.author ? item.author : "Author not specified"},{" "}
                                    {getLicenseText(item.license)}
                                </p>
                            </div>
                        )}
                    />
                )}
            </section>
        </div>
    );
};

export default CollectionDetail;
