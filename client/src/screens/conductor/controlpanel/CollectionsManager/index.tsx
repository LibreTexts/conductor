import { useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import {
    Breadcrumb,
    Button,
    Heading,
    Pagination,
    Select,
    Stack,
    Text,
    Link as DavisLink,
} from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import { IconPhoto, IconPlus } from "@tabler/icons-react";
import classNames from "classnames";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { Collection } from "../../../../types";
import EditCollection from "../../../../components/controlpanel/Collections/EditCollection";
import { catalogItemsPerPageOptions } from "../../../../components/util/PaginationOptions.js";
import { useTypedSelector } from "../../../../state/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { useModals } from "../../../../context/ModalContext";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";

const ROOT_PATH = "/controlpanel/collectionsmanager";

type AllCollectionsResponse = {
    collections: Collection[];
    total_items: number;
};

const ITEMS_PER_PAGE_OPTIONS = catalogItemsPerPageOptions.map((o) => ({
    label: o.text,
    value: String(o.value),
}));

/**
 * Small cover-image preview for a collection row. Renders a neutral placeholder
 * (no <img> request) when there's no cover set or the image fails to load, and
 * fades the real image in only once it has loaded — avoiding the browser's
 * broken-image glyph flickering in.
 */
const CoverThumb = ({ src }: { src?: string }) => {
    const [status, setStatus] = useState<"loading" | "loaded" | "error">(
        src ? "loading" : "error"
    );
    return (
        <div className="h-12 w-9 flex items-center justify-center overflow-hidden rounded bg-gray-100 outline -outline-offset-1 outline-black/5">
            {status === "error" ? (
                <IconPhoto size={16} className="text-gray-400" aria-hidden="true" />
            ) : (
                <img
                    src={src}
                    alt=""
                    className={classNames(
                        "h-full w-full object-cover transition-opacity",
                        status === "loaded" ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setStatus("loaded")}
                    onError={() => setStatus("error")}
                />
            )}
        </div>
    );
};

/**
 * The Collections Manager lists an organization's root-level collections in a
 * table. Selecting a collection navigates to its dedicated detail page
 * (`/controlpanel/collectionsmanager/:collID`), where its books and nested
 * collections are managed.
 */
const CollectionsManager = () => {
    const { handleGlobalError } = useGlobalError();
    const org = useTypedSelector((state) => state.org);
    const history = useHistory();
    const { openModal, closeAllModals } = useModals();
    const queryClient = useQueryClient();

    useDocumentTitle("Collections Manager");

    const [activePage, setActivePage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(12);
    const [totalItems, setTotalItems] = useState<number>(0);

    const ALL_COLL_QUERY_KEY = ["all-collections", activePage, itemsPerPage];
    const { data, isFetching: loading } = useQuery<AllCollectionsResponse>({
        queryKey: ALL_COLL_QUERY_KEY,
        queryFn: getAllCollections,
    });

    useEffect(() => {
        setActivePage(1); // Reset to first page when itemsPerPage changes
    }, [itemsPerPage]);

    async function getAllCollections(): Promise<AllCollectionsResponse> {
        try {
            const res = await api.getAllCollections({
                page: activePage,
                limit: itemsPerPage,
            });
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }

            setTotalItems(res.data.total_items || 0);

            return {
                collections: res.data.collections || [],
                total_items: res.data.total_items || 0,
            };
        } catch (err) {
            handleGlobalError(err);
            return {
                collections: [],
                total_items: 0,
            };
        }
    }

    const openCreateCollModal = () => {
        openModal(
            <EditCollection
                show={true}
                mode="create"
                onCloseFunc={closeAllModals}
                onSuccessFunc={() => {
                    closeAllModals();
                    queryClient.invalidateQueries(["all-collections"]);
                }}
            />
        );
    };

    const columns = useMemo<ColumnDef<Collection>[]>(
        () => [
            {
                id: "cover",
                header: "Cover",
                cell: ({ row }) => <CoverThumb src={row.original.coverPhoto} />,
            },
            {
                id: "title",
                header: "Title",
                accessorKey: "title",
                cell: ({ row }) => (
                    <Link
                        to={`${ROOT_PATH}/${row.original.collID}`}
                        className="font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {row.original.title}
                    </Link>
                ),
            },
            {
                id: "privacy",
                header: "Privacy",
                accessorKey: "privacy",
                cell: ({ row }) => (
                    <span className="capitalize">{row.original.privacy}</span>
                ),
            },
            {
                id: "program",
                header: "Program",
                cell: ({ row }) => row.original.program || "—",
            },
            {
                id: "resources",
                header: "Resources",
                cell: ({ row }) => (row.original.resourceCount ?? 0).toLocaleString(),
            },
        ],
        []
    );

    const paginationState = {
        pageIndex: activePage - 1,
        pageSize: itemsPerPage,
    };

    return (
        <div className="px-8">
            <Stack direction="horizontal" gap="md" align="start" justify="between" className="my-8">
                <Stack direction="vertical" gap="sm">
                    <Heading level={1}>Collections Manager</Heading>
                    <Breadcrumb aria-label="Collections navigation">
                        <Breadcrumb.Item>
                            <Link
                                to="/controlpanel"
                                className="text-primary hover:underline"
                            >
                                Control Panel
                            </Link>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item isCurrent>Collections Manager</Breadcrumb.Item>
                    </Breadcrumb>
                </Stack>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="primary"
                        icon={<IconPlus size={16} />}
                        onClick={openCreateCollModal}
                    >
                        New Collection
                    </Button>
                </div>
            </Stack>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 p-4">
                {org.collectionsDisplayLabel && (
                    <Text as="p">
                        These collections will appear as{" "}
                        <strong>{org.collectionsDisplayLabel}</strong> in your Campus
                        Commons. You can change this label in{" "}
                        <DavisLink
                            href="/controlpanel/campussettings"
                            target="_blank"
                            className="text-primary hover:underline"
                            external
                        >
                            Campus Settings
                        </DavisLink>
                        .
                    </Text>
                )}
                <DataTable
                    data={data?.collections || []}
                    columns={columns}
                    loading={loading}
                    density="compact"
                    bordered
                    striped
                    stickyHeader
                    caption="Root collections"
                    enablePagination
                    pageSize={itemsPerPage}
                    pageSizeOptions={ITEMS_PER_PAGE_OPTIONS.map((o) => parseInt(o.value))}
                    tableOptions={{
                        manualPagination: true,
                        manualFiltering: true,
                        manualSorting: true,
                        rowCount: totalItems,
                        state: {
                            pagination: paginationState
                        },
                        onPaginationChange: (updater) => {
                            const nextPagination =
                                typeof updater === "function"
                                    ? updater(paginationState)
                                    : updater;

                            setActivePage(nextPagination.pageIndex + 1);
                            setItemsPerPage(nextPagination.pageSize);
                        },
                    }
                    }
                    emptyState={
                        < div className="py-8 text-center" >
                            <Text>
                                <em>No collections yet. Create one to get started.</em>
                            </Text>
                        </div>
                    }
                    onRowClick={(row) => history.push(`${ROOT_PATH}/${row.collID}`)}
                />
            </div>
        </div >
    );
};

export default CollectionsManager;
