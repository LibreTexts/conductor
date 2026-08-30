import { Link } from "react-router-dom";
import { Badge, Breadcrumb, Button, Heading, Input, Select, Stack } from "@libretexts/davis-react";
import type { BadgeVariant } from "@libretexts/davis-react";
import { StoreOrderListItem } from "../../../../types";
import { autoHealLabel, autoHealVariant } from "./auto-heal";
import useGlobalError from "../../../../components/error/ErrorHooks";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../../api";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import useDebounce from "../../../../hooks/useDebounce";
import {
  IconCloudComputing,
  IconDownload,
  IconEye,
  IconSearch,
} from "@tabler/icons-react";
import { useNotifications } from "../../../../context/NotificationContext";
import { formatPrice, truncateOrderId } from "../../../../utils/storeHelpers";
import { useMemo, useState } from "react";

function luluStatusVariant(status?: string | null): BadgeVariant {
  if (!status) return "default";
  if (["REJECTED", "ERROR"].includes(status)) return "danger";
  if (status === "SHIPPED") return "success";
  if (["IN_PRODUCTION", "PRODUCTION_DELAYED"].includes(status)) return "warning";
  if (status === "CREATED") return "primary";
  return "default";
}

function orderStatusVariant(status?: string): BadgeVariant {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "default";
}

const StoreManager = () => {
  useDocumentTitle("LibreTexts Store Management");
  const limit = 25;
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const [statusFilter, setStatusFilter] = useState("all");
  const [luluStatusFilter, setLuluStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce the value that actually drives the query so each keystroke doesn't refetch.
  const debouncedSetQuery = useMemo(
    () => debounce((value: string) => setSearchQuery(value.trim()), 400),
    []
  );

  const { data, isFetching, isInitialLoading, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["store-orders", limit, statusFilter, luluStatusFilter, searchQuery],
      queryFn: async ({ pageParam = null }) => {
        const response = await api.adminGetStoreOrders({
          limit,
          starting_after: pageParam || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          lulu_status:
            luluStatusFilter === "all" ? undefined : luluStatusFilter,
          query: searchQuery || undefined,
        });

        if (response.data.err) {
          handleGlobalError(
            response.data.errMsg || "Failed to fetch store orders."
          );
          return {
            items: [],
            meta: { total_count: 0, has_more: false, next_page: null },
          };
        }
        return response.data;
      },
      getNextPageParam: (lastPage) =>
        lastPage?.meta?.has_more ? lastPage.meta.next_page : undefined,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });

  const allData = data?.pages.flatMap((page) => page.items) || [];
  const lastPage = data?.pages[data.pages.length - 1];

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-6">
        <Heading level={2}>LibreTexts Store Management</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Store Management</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-end gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grow min-w-[16rem]">
            <Input
              name="orderSearch"
              type="search"
              label="Search Orders"
              placeholder="Search by order ID, customer email, or Lulu job ID"
              value={searchInput}
              leftIcon={<IconSearch size={16} />}
              onChange={(e) => {
                setSearchInput(e.target.value);
                debouncedSetQuery(e.target.value);
              }}
            />
          </div>
          <Select
            name="luluStatusFilter"
            label="Lulu Job Status"
            value={luluStatusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "CREATED", label: "Created" },
              { value: "IN_PRODUCTION", label: "In Production" },
              { value: "PRODUCTION_DELAYED", label: "Production Delayed" },
              { value: "REJECTED", label: "Rejected" },
              { value: "SHIPPED", label: "Shipped" },
            ]}
            placeholder="Filter by Lulu Job Status"
            onChange={(e) => setLuluStatusFilter(e.target.value)}
          />
          <Select
            name="statusFilter"
            label="Order Status"
            value={statusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
            ]}
            placeholder="Filter by Order Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        <SupportCenterTable<StoreOrderListItem & { actions?: string }>
          loading={isInitialLoading}
          data={allData || []}
          columns={[
            {
              accessor: "id",
              title: "Order ID",
              copyButton: true,
              render(record) {
                return truncateOrderId(record.id);
              },
            },
            {
              accessor: "createdAt",
              title: "Order Date",
              render(record) {
                return (
                  <span>
                    {record.createdAt
                      ? new Date(record.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })
                      : ""}
                  </span>
                );
              },
            },
            {
              accessor: "customerEmail",
              title: "Customer Email",
              copyButton: true,
              render(record) {
                return record.customerEmail || "Unknown";
              },
            },
            {
              accessor: "amountTotal",
              title: "Total Amount",
              render(record) {
                return (
                  <span>
                    {record.amountTotal
                      ? formatPrice(record.amountTotal, true)
                      : "$0.00"}
                  </span>
                );
              },
            },
            {
              accessor: "luluJobID",
              title: "Lulu Job ID",
              render(record) {
                if (!record.luluJobID && record.status !== "failed") {
                  return (
                    <span className="text-gray-500">
                      <IconCloudComputing className="inline-block h-5 w-5 text-gray-500 mr-1 pb-0.5" />
                      Digital Only
                    </span>
                  );
                }
                return (
                  <span>
                    {record.luluJobID && (
                      <a
                        className="text-blue-600 hover:underline"
                        href={`https://developers.lulu.com/print-jobs/detail/${record.luluJobID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {record.luluJobID}
                      </a>
                    )}
                  </span>
                );
              },
            },
            {
              accessor: "luluJobStatus",
              title: "Lulu Job Status",
              render(record) {
                const healLabel = autoHealLabel(record.autoHealState);
                if (!record.luluJobStatus && !healLabel) return <span>--</span>;
                return (
                  <span className="flex flex-wrap items-center gap-1">
                    {record.luluJobStatus && (
                      <Badge
                        label={record.luluJobStatus}
                        variant={luluStatusVariant(record.luluJobStatus)}
                        size="sm"
                      />
                    )}
                    {healLabel && (
                      <Badge
                        label={healLabel}
                        variant={autoHealVariant(record.autoHealState)}
                        size="sm"
                      />
                    )}
                  </span>
                );
              },
            },
            {
              accessor: "status",
              title: "Status",
              render(record) {
                return (
                  <Badge
                    label={record.status}
                    variant={orderStatusVariant(record.status)}
                    size="sm"
                    className="capitalize"
                  />
                );
              },
            },
            {
              accessor: "actions",
              title: "Actions",
              render(record) {
                return (
                  <a
                    href={`/controlpanel/store/orders/${record.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="primary" icon={<IconEye size={16} />} size="sm">
                      View Details
                    </Button>
                  </a>
                );
              },
            },
          ]}
        />

        {lastPage?.meta?.has_more && (
          <div className="flex justify-center p-4 border-t border-gray-200">
            <Button
              onClick={() => fetchNextPage()}
              loading={isFetching || isInitialLoading}
              variant="secondary"
              icon={<IconDownload size={16} />}
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreManager;
