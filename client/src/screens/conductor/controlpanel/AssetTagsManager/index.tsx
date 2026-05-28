import { useState, useEffect, lazy, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Badge,
  Breadcrumb,
  Button,
  Heading,
  IconButton,
  Heading,
  IconButton,
  Input,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconSchool,
} from "@tabler/icons-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
import {
  AssetTagFrameworkWithCampusDefault,
} from "../../../../types";
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

const ITEMS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10 per page" },
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

interface PaginationRowProps {
  activePage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

const PaginationRow: React.FC<PaginationRowProps> = ({
  activePage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (activePage - 1) * itemsPerPage + 1;
  const end = Math.min(activePage * itemsPerPage, totalItems);
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2">
        <Select
          options={ITEMS_PER_PAGE_OPTIONS}
          value={String(itemsPerPage)}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
        />
        <span className="text-sm text-gray-600">
          {start}–{end} of {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          icon={<IconChevronLeft size={16} />}
          aria-label="Previous page"
          variant="ghost"
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage <= 1}
        />
        <span className="text-sm text-gray-600 px-2">
          {activePage} / {totalPages || 1}
        </span>
        <IconButton
          icon={<IconChevronRight size={16} />}
          aria-label="Next page"
          variant="ghost"
          onClick={() => onPageChange(activePage + 1)}
          disabled={activePage >= totalPages}
        />
      </div>
    </div>
  );
};

const AssetTagsManager: React.FC<{}> = () => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const org = useTypedSelector((state) => state.org);
  const queryClient = useQueryClient();

  const [frameworks, setFrameworks] = useState<AssetTagFrameworkWithCampusDefault[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [defaultToSet, setDefaultToSet] = useState<string>("");
  const [showConfirmSetOrgDefault, setShowConfirmSetOrgDefault] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchString, setSearchString] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showManageFrameworkModal, setShowManageFrameworkModal] = useState<boolean>(false);
  const [manageFrameworkMode, setManageFrameworkMode] = useState<"create" | "edit">("create");
  const [manageFrameworkId, setManageFrameworkId] = useState<string>("");

  useEffect(() => {
    getFrameworks(searchString);
  }, [activePage, itemsPerPage]);

  async function getFrameworks(query?: string) {
    try {
      setLoading(true);
      const res = await api.getFrameworks({
        page: activePage,
        limit: itemsPerPage,
        query,
      });

      if (
        res.data.err ||
        !res.data.frameworks ||
        !Array.isArray(res.data.frameworks) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving frameworks");
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
      if (res.data.err) throw new Error(res.data.errMsg);
      queryClient.invalidateQueries(["campusDefaultFramework", org.orgID]);
      getFrameworks(searchString);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
      setDefaultToSet("");
      setDefaultToSet("");
      setShowConfirmSetOrgDefault(false);
    }
  }

  function handleOpenManageFrameworkModal(mode: "create" | "edit", id?: string) {
    setManageFrameworkMode(mode);
    setManageFrameworkId(mode === "edit" && id ? id : "");
    setShowManageFrameworkModal(true);
  }

  function handleCloseManageFrameworkModal() {
    setShowManageFrameworkModal(false);
    setManageFrameworkMode("create");
    setManageFrameworkId("");
    getFrameworks(searchString);
  }

  const displayFrameworks = useMemo(() => {
    if (statusFilter === "all") return frameworks;
    if (statusFilter === "enabled") return frameworks.filter((f) => f.enabled);
    return frameworks.filter((f) => !f.enabled);
  }, [frameworks, statusFilter]);

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
          <div className="flex items-center gap-2 justify-end">
            {!row.original.isCampusDefault && (
              <Button
                variant="outline"
                icon={<IconSchool size={16} />}
                onClick={() => {
                  setDefaultToSet(row.original.uuid);
                  setShowConfirmSetOrgDefault(true);
                }}
              >
                Set as Campus Default
              </Button>
            )}
            <Button
              variant="primary"
              icon={<IconEdit size={16} />}
              onClick={() => handleOpenManageFrameworkModal("edit", row.original.uuid)}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="row" className="justify-between items-center mb-2">
        <Heading level={2}>Asset Tagging Framework Manager</Heading>
        <Button
          variant="primary"
          icon={<IconPlus size={16} />}
          onClick={() => handleOpenManageFrameworkModal("create")}
        >
          New Framework
        </Button>
      </Stack>

      <Breadcrumb className="mb-6">
        <Breadcrumb.Item as={Link} to="/controlpanel">
          Control Panel
        </Breadcrumb.Item>
        <Breadcrumb.Item active>Asset Tagging Framework Manager</Breadcrumb.Item>
      </Breadcrumb>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-gray-200 bg-gray-50">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name or description..."
              value={searchString}
              onChange={(e) => {
                setSearchString(e.target.value);
                getFrameworksDebounced(e.target.value);
              }}
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        <PaginationRow
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          onPageChange={setActivePage}
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            setActivePage(1);
          }}
        />

        <DataTable
          data={displayFrameworks}
          columns={columns}
          loading={loading}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Asset tag frameworks list"
          emptyState={
            <div className="py-8 text-center">
              <Text>
                <em>No results found.</em>
              </Text>
            </div>
          }
        />

        <PaginationRow
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          onPageChange={setActivePage}
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            setActivePage(1);
          }}
        />
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
    </div>
  );
};

export default AssetTagsManager;
