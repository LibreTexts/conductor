import { useMemo, useState } from "react";
import {
  Breadcrumb,
  Button,
  Heading,
  Input,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconPlus,
} from "@tabler/icons-react";
import { Author } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useModals } from "../../../../context/ModalContext";
import { useNotifications } from "../../../../context/NotificationContext";
import { truncateString } from "../../../../components/util/HelperFunctions";
import CopyButton from "../../../../components/util/CopyButton";
import ManageAuthorModal from "../../../../components/controlpanel/AuthorsManager/ManageAuthorModal";

const LIMIT = 25;

const SORT_OPTIONS = [
  { label: "Sort by Name Key", value: "nameKey" },
  { label: "Sort by Name", value: "name" },
  { label: "Sort by Company Name", value: "companyName" },
];

const AuthorsManager = () => {
  useDocumentTitle("LibreTexts Conductor | Authors Manager");
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();

  const [sortChoice, setSortChoice] = useState("nameKey");
  const [searchString, setSearchString] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data, isFetching, isInitialLoading, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["authors", LIMIT, sortChoice, activeSearch],
      queryFn: async ({ pageParam = null }) => {
        const response = await api.getAuthors({
          limit: LIMIT,
          page: pageParam || 1,
          sort: sortChoice,
          query: activeSearch || undefined,
        });
        if (response.data.err) {
          handleGlobalError(response.data.errMsg || "Failed to fetch authors.");
          return {
            items: [],
            meta: { total_count: 0, has_more: false, next_page: null },
          };
        }
        return response.data;
      },
      getNextPageParam: (lastPage) => {
        const nextPage =
          lastPage?.meta?.has_more && lastPage.meta.next_page
            ? lastPage.meta.next_page
            : undefined;
        const parsed = parseInt(nextPage as string, 10);
        return isNaN(parsed) ? undefined : parsed;
      },
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });

  const allData = data?.pages.flatMap((page) => page.items) || [];
  const lastPage = data?.pages[data.pages.length - 1];

  function handleOpenManageModal(authorID?: string) {
    openModal(
      <ManageAuthorModal
        show
        onClose={() => closeAllModals()}
        authorID={authorID}
      />
    );
  }

  function renderURLCell(url?: string) {
    if (!url) return null;
    let parsedURL: URL;
    try {
      parsedURL = new URL(url);
    } catch {
      return null;
    }
    return parsedURL.hostname ? (
      <a
        href={parsedURL.toString()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {truncateString(parsedURL.toString(), 30)}
        <IconExternalLink size={14} aria-hidden="true" />
      </a>
    ) : null;
  }

  const columns = useMemo<ColumnDef<Author>[]>(
    () => [
      {
        id: "nameKey",
        header: "Name Key (Unique)",
        accessorKey: "nameKey",
        cell: ({ row }) => (
          <div className="flex items-center gap-1 font-mono">
            <span>{truncateString(row.original.nameKey, 30)}</span>
            <CopyButton val={row.original.nameKey || ""}>
              {({ copied, copy }) => (
                <button
                  type="button"
                  className="cursor-pointer text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    copy();
                    addNotification({
                      message: "Copied to clipboard",
                      type: "success",
                      duration: 2000,
                    });
                  }}
                  aria-label="Copy name key"
                >
                  {copied
                    ? <IconCheck size={14} className="text-green-600" />
                    : <IconCopy size={14} />}
                </button>
              )}
            </CopyButton>
          </div>
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.pictureURL && (
              <img
                alt={row.original.name}
                src={row.original.pictureURL}
                className="inline-block size-7 rounded-full outline -outline-offset-1 outline-black/5"
              />
            )}
            <span>{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "nameTitle",
        header: "Name Title",
      },
      {
        id: "nameURL",
        header: "Name URL",
        cell: ({ row }) => renderURLCell(row.original.nameURL),
      },
      {
        accessorKey: "companyName",
        header: "Company Name",
      },
      {
        id: "companyURL",
        header: "Company URL",
        cell: ({ row }) => renderURLCell(row.original.companyURL),
      },
      {
        accessorKey: "programName",
        header: "Program Name",
      },
      {
        id: "programURL",
        header: "Program URL",
        cell: ({ row }) => renderURLCell(row.original.programURL),
      },
    ],
    [addNotification]
  );

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Authors Manager</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Authors Manager</Breadcrumb.Item>
          </Breadcrumb>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => handleOpenManageModal()}
            >
              Add Author
            </Button>
          </div>
        </div>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:max-w-4xl">
            <Select
              name="sort"
              label="Sort"
              placeholder="Sort by..."
              options={SORT_OPTIONS}
              value={sortChoice}
              onChange={(e) => setSortChoice(e.target.value)}
            />
            <div className="md:col-span-2">
              <Input
                name="search"
                label="Search"
                placeholder="Search by Name Key, Name, or Company"
                value={searchString}
                onChange={(e) => {
                  setSearchString(e.target.value);
                  debounce(
                    (val: string) => setActiveSearch(val),
                    300
                  )(e.target.value.trim());
                }}
              />
            </div>
          </div>
        </div>

        <DataTable
          data={allData}
          columns={columns}
          loading={isInitialLoading}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Authors list"
          emptyState={
            <div className="py-8 text-center">
              <Text><em>No authors found.</em></Text>
            </div>
          }
          onRowClick={(row) => handleOpenManageModal(row._id)}
        />

        {lastPage?.meta?.has_more && (
          <div className="flex justify-center p-4 border-t border-gray-200">
            <Button
              variant="primary"
              icon={<IconDownload size={16} />}
              onClick={() => fetchNextPage()}
              loading={isFetching || isInitialLoading}
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorsManager;
