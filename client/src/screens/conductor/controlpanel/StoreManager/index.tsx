import { Link } from "react-router-dom";
import { Badge, Breadcrumb, Button, Heading, Select, Stack } from "@libretexts/davis-react";
import type { BadgeVariant } from "@libretexts/davis-react";
import { StoreOrderWithStripeSession } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../../api";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import {
  IconCloudComputing,
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import { useNotifications } from "../../../../context/NotificationContext";
import { formatPrice, truncateOrderId } from "../../../../utils/storeHelpers";
import { useState } from "react";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [luluStatusFilter, setLuluStatusFilter] = useState("all");

  const { data, isFetching, isInitialLoading, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["store-orders", limit, statusFilter, luluStatusFilter],
      queryFn: async ({ pageParam = null }) => {
        const response = await api.adminGetStoreOrders({
          limit,
          starting_after: pageParam || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          lulu_status:
            luluStatusFilter === "all" ? undefined : luluStatusFilter,
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
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
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
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        <SupportCenterTable<StoreOrderWithStripeSession & { actions?: string }>
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
              accessor: "stripe_session",
              title: "Customer Email",
              copyButton: true,
              render(record) {
                return record.stripe_session?.customer_email || "Unknown";
              },
            },
            {
              accessor: "stripe_session",
              title: "Total Amount",
              render(record) {
                return (
                  <span>
                    {record.stripe_session?.amount_total
                      ? formatPrice(record.stripe_session.amount_total, true)
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
                if (!record.luluJobStatus) return <span>--</span>;
                return (
                  <Badge
                    label={record.luluJobStatus}
                    variant={luluStatusVariant(record.luluJobStatus)}
                    size="sm"
                  />
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
