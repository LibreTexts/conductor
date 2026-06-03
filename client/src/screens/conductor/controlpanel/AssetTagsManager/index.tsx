import { useState, useEffect, lazy, useMemo } from "react";
import {
  Badge,
  Breadcrumb,
  Button,
  Heading,
  IconButton,
  Input,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
import { AssetTagFrameworkWithCampusDefault } from "../../../../types";
import { truncateString } from "../../../../components/util/HelperFunctions";
import { useTypedSelector } from "../../../../state/hooks";
import { useQueryClient } from "@tanstack/react-query";
const ManageFrameworkModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/AssetTagsManager/ManageFrameworkModal"
    )
);
const ConfirmSetOrgDefault = lazy(
  () =>
    import(
      "../../../../components/controlpanel/AssetTagsManager/ConfirmSetOrgDefault"
    )
);

const ITEMS_PER_PAGE_OPTIONS = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

const AssetTagsManager: React.FC<{}> = ({}) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const org = useTypedSelector((state) => state.org);
  const queryClient = useQueryClient();

  const [frameworks, setFrameworks] = useState<
    AssetTagFrameworkWithCampusDefault[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [defaultToSet, setDefaultToSet] = useState<string>("");
  const [showConfirmSetOrgDefault, setShowConfirmSetOrgDefault] =
    useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchString, setSearchString] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showManageFrameworkModal, setShowManageFrameworkModal] =
    useState<boolean>(false);
  const [manageFrameworkMode, setManageFrameworkMode] = useState<
    "create" | "edit"
  >("create");
  const [manageFrameworkId, setManageFrameworkId] = useState<string>("");

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "enabled", label: "Enabled" },
    { value: "disabled", label: "Disabled" },
  ];

  useEffect(() => {
    getFrameworks(searchString);
  }, [activePage, itemsPerPage]);

  async function getFrameworks(search?: string) {
    try {
      setLoading(true);

      const res = await api.getFrameworks({
        page: activePage,
        limit: itemsPerPage,
        query: search,
      });

      if (
        res.data.err ||
        !res.data.frameworks ||
        !Array.isArray(res.data.frameworks) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving frameworks");
      }

      setFrameworks(res.data.frameworks);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getFrameworksDebounced = debounce(
    (searchVal: string) => getFrameworks(searchVal),
    500
  );

  async function setAsOrgDefault(id: string) {
    try {
      setLoading(true);

      const res = await api.setAsCampusDefaultFramework(org.orgID, id);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      queryClient.invalidateQueries(["campusDefaultFramework", org.orgID]);
      getFrameworks(searchString);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
      setDefaultToSet("");
      setShowConfirmSetOrgDefault(false);
    }
  }

  function handleCloseManageFrameworkModal() {
    setShowManageFrameworkModal(false);
    setManageFrameworkMode("create");
    setManageFrameworkId("");
    getFrameworks(searchString);
  }

  const columns = useMemo<ColumnDef<AssetTagFrameworkWithCampusDefault>[]>(
    () => [
      {
        id: "name",
        header: "Framework Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.original.name}</span>
            {row.original.isCampusDefault && (
              <Badge label="Campus Default" variant="success" size="sm" />
            )}
          </div>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        cell: ({ row }) => (
          <span>{truncateString(row.original.description, 75)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "enabled",
        cell: ({ row }) => (
          <span>{row.original.enabled ? "Enabled" : "Disabled"}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {!row.original.isCampusDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDefaultToSet(row.original.uuid);
                  setShowConfirmSetOrgDefault(true);
                }}
              >
                Set as Campus Default
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setManageFrameworkMode("edit");
                setManageFrameworkId(row.original.uuid);
                setShowManageFrameworkModal(true);
              }}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  function PaginationRow() {
    return (
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm">
          <span>Displaying</span>
          <Select
            name="itemsPerPage"
            label="Items per page"
            labelClassName="sr-only"
            value={String(itemsPerPage)}
            options={ITEMS_PER_PAGE_OPTIONS}
            placeholder="10"
            onChange={(e) => {
              setItemsPerPage(parseInt(e.target.value));
              setActivePage(1);
            }}
          />
          <span>
            items per page of <strong>{totalItems}</strong> total results.
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            variant="outline"
            aria-label="Previous page"
            icon={<IconChevronLeft size={16} />}
            onClick={() => setActivePage(Math.max(1, activePage - 1))}
            disabled={activePage <= 1}
          />
          <span className="px-3 py-1 border border-gray-300 rounded text-sm min-w-[2rem] text-center">
            {activePage}
          </span>
          <IconButton
            variant="outline"
            aria-label="Next page"
            icon={<IconChevronRight size={16} />}
            onClick={() => setActivePage(Math.min(totalPages, activePage + 1))}
            disabled={activePage >= totalPages}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Asset Tagging Framework Manager</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>
              Asset Tagging Framework Manager
            </Breadcrumb.Item>
          </Breadcrumb>
          <Button
            variant="primary"
            icon={<IconPlus size={16} />}
            onClick={() => {
              setManageFrameworkMode("create");
              setManageFrameworkId("");
              setShowManageFrameworkModal(true);
            }}
          >
            New Framework
          </Button>
        </div>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:max-w-4xl">
            <div className="md:col-span-2">
              <Input
                name="search"
                label="Search"
                placeholder="Search by Name or Description"
                value={searchString}
                onChange={(e) => {
                  setSearchString(e.target.value);
                  getFrameworksDebounced(e.target.value);
                }}
              />
            </div>
            <Select
              name="statusFilter"
              label="Status"
              placeholder="All"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="border-b border-gray-200">
          <PaginationRow />
        </div>

        <DataTable
          data={frameworks.filter((f) => {
            if (statusFilter === "enabled") return f.enabled;
            if (statusFilter === "disabled") return !f.enabled;
            return true;
          })}
          columns={columns}
          loading={loading}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Asset tagging frameworks list"
          emptyState={
            <div className="py-8 text-center">
              <Text><em>No frameworks found.</em></Text>
            </div>
          }
        />

        <div className="border-t border-gray-200">
          <PaginationRow />
        </div>
      </div>

      <ManageFrameworkModal
        open={showManageFrameworkModal}
        mode={manageFrameworkMode}
        id={manageFrameworkId}
        onClose={() => handleCloseManageFrameworkModal()}
      />
      <ConfirmSetOrgDefault
        show={showConfirmSetOrgDefault}
        selectedUUID={defaultToSet}
        onClose={() => {
          setShowConfirmSetOrgDefault(false);
          setDefaultToSet("");
        }}
        onConfirm={() => setAsOrgDefault(defaultToSet)}
      />
    </div>
  );
};

export default AssetTagsManager;
