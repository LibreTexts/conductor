import { useEffect, useState } from "react";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Heading,
  Input,
  Select,
  Stack,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, PaginationState } from "@libretexts/davis-react-table";
import { IconEye, IconSearch } from "@tabler/icons-react";
import api from "../../../../api";
import ViewServiceDetailsModal from "../../../../components/controlpanel/CentralIdentity/ViewServiceDetailsModal";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDebounce from "../../../../hooks/useDebounce";
import { useTypedSelector } from "../../../../state/hooks";
import { CentralIdentityService } from "../../../../types";

const sortOptions = [
  { label: "Sort by Name", value: "name" },
  { label: "Sort by Service URL", value: "service_Id" },
];

const CentralIdentityServices = () => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchString, setSearchString] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [sortChoice, setSortChoice] = useState("name");
  const [services, setServices] = useState<CentralIdentityService[]>([]);
  const [selectedService, setSelectedService] =
    useState<CentralIdentityService | null>(null);

  useEffect(() => {
    if (isSuperAdmin) void getServices(searchString);
  }, [activePage, itemsPerPage, searchString, sortChoice, isSuperAdmin]);

  const getServicesDebounced = debounce(
    (searchValue: string) => {
      setActivePage(1);
      setSearchString(searchValue);
    },
    250
  );

  async function getServices(query: string) {
    try {
      setLoading(true);
      const res = await api.getCentralIdentityServices({
        activePage,
        limit: itemsPerPage,
        query,
        sort: sortChoice,
      });

      if (
        res.data.err ||
        !Array.isArray(res.data.services) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving services");
      }

      setServices(res.data.services);
      setTotalCount(res.data.totalCount);
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectService(service: CentralIdentityService) {
    setSelectedService(service);
    setShowServiceModal(true);
  }

  const columns: ColumnDef<CentralIdentityService>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "service_Id",
      header: "ID",
      cell: ({ row }) => (
        <span className="break-all">{row.original.service_Id}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          icon={<IconEye size={16} aria-hidden="true" />}
          onClick={() => handleSelectService(row.original)}
        >
          View Service
        </Button>
      ),
    },
  ];

  const paginationState: PaginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  if (!isSuperAdmin) {
    return (
      <div className="!p-8">
        <Alert
          variant="error"
          title="Access denied"
          message="You must be a Superadmin to access this page."
        />
      </div>
    );
  }

  return (
    <div className="controlpanel-container !h-full">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Console: Services</Heading>

        <Card variant="outline" padding="none" className="overflow-hidden">
          <div className="border-b border-gray-200 p-4">
            <Breadcrumb>
              <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
              <Breadcrumb.Item href="/controlpanel/libreone">
                LibreOne Admin Console
              </Breadcrumb.Item>
              <Breadcrumb.Item isCurrent>Services</Breadcrumb.Item>
            </Breadcrumb>
          </div>

          <div className="flex flex-col gap-4 border-b border-gray-200 p-4 md:flex-row md:items-end md:justify-between">
            <Select
              name="service-sort"
              label="Sort services"
              placeholder="Sort by..."
              options={sortOptions}
              value={sortChoice}
              onChange={(event) => {
                setActivePage(1);
                setSortChoice(event.target.value);
              }}
              className="w-full md:max-w-72"
            />
            <Input
              name="service-search"
              label="Search services"
              placeholder="Search by Name or ID..."
              value={searchInput}
              rightIcon={<IconSearch size={18} aria-hidden="true" />}
              onChange={(event) => {
                setSearchInput(event.target.value);
                getServicesDebounced(event.target.value);
              }}
              className="w-full md:max-w-xl"
            />
          </div>

          <div className="p-4">
            <DataTable<CentralIdentityService>
              data={services}
              columns={columns}
              loading={loading}
              density="compact"
              striped
              bordered
              enablePagination
              pageSize={itemsPerPage}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyState="No results found."
              tableOptions={{
                manualPagination: true,
                rowCount: totalCount,
                state: { pagination: paginationState },
                onPaginationChange: (updater) => {
                  const nextPagination =
                    typeof updater === "function"
                      ? updater(paginationState)
                      : updater;
                  setActivePage(nextPagination.pageIndex + 1);
                  setItemsPerPage(nextPagination.pageSize);
                },
              }}
            />
          </div>
        </Card>
      </Stack>

      <ViewServiceDetailsModal
        open={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        service={selectedService}
        onServiceUpdated={() => void getServices(searchString)}
      />
    </div>
  );
};

export default CentralIdentityServices;
