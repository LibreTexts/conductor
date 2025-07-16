import { Link } from "react-router-dom";
import { Header, Segment, Grid, Breadcrumb } from "semantic-ui-react";
import {
  GetStoreOrdersResponse,
  StoreOrderWithStripeSession,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../../api";
import Button from "../../../../components/NextGenComponents/Button";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import CopyButton from "../../../../components/util/CopyButton";
import { IconClipboardFilled } from "@tabler/icons-react";
import { useNotifications } from "../../../../context/NotificationContext";
import { formatPrice, truncateOrderId } from "../../../../utils/storeHelpers";
import Select from "../../../../components/NextGenInputs/Select";
import { useState } from "react";

const StoreManager = () => {
  useDocumentTitle("LibreTexts Store Management");
  const limit = 25;
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const [statusFilter, setStatusFilter] = useState("all");
  const [luluStatusFilter, setLuluStatusFilter] = useState("all");
  // const [sortBy, setSortBy] = useState("created");
  const { data, isFetching, isInitialLoading, fetchNextPage } =
    useInfiniteQuery<GetStoreOrdersResponse>({
      queryKey: ["store-orders", limit, statusFilter, luluStatusFilter],
      queryFn: async ({ pageParam = null }) => {
        const response = await api.adminGetStoreOrders({
          limit,
          starting_after: pageParam || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          lulu_status:
            luluStatusFilter === "all" ? undefined : luluStatusFilter,
          // sort_by: sortBy,
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
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    });

  const allData = data?.pages.flatMap((page) => page.items) || [];
  const lastPage = data?.pages[data.pages.length - 1];

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreTexts Store Management
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Store Management</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex items-center">
                  <Select
                    name="luluStatusFilter"
                    options={[
                      { value: "all", label: "All" },
                      { value: "CREATED", label: "Created" },
                      { value: "IN_PRODUCTION", label: "In Production" },
                      {
                        value: "PRODUCTION_DELAYED",
                        label: "Production Delayed",
                      },
                      { value: "REJECTED", label: "Rejected" },
                      { value: "SHIPPED", label: "Shipped" },
                    ]}
                    label="Lulu Job Status"
                    onChange={(e) => {
                      setLuluStatusFilter(e.target.value);
                    }}
                    className="mr-4"
                  />
                  <Select
                    name="statusFilter"
                    options={[
                      { value: "all", label: "All" },
                      { value: "pending", label: "Pending" },
                      { value: "completed", label: "Completed" },
                      { value: "failed", label: "Failed" },
                    ]}
                    label="Order Status"
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                    }}
                  />
                </div>
                {/* <div className="flex items-center">
                  <Select
                    name="sortBy"
                    options={[
                      { value: "created", label: "Date Created" },
                      { value: "status", label: "Status" },
                    ]}
                    label="Sort By"
                    onChange={(e) => {
                      setSortBy(e.target.value);
                    }}
                  />
                </div> */}
              </div>
              <SupportCenterTable<
                StoreOrderWithStripeSession & { actions?: string }
              >
                loading={isInitialLoading}
                data={allData || []}
                columns={[
                  {
                    accessor: "id",
                    title: "Order ID",
                    render(record, index) {
                      return (
                        <div className="flex items-center">
                          <span>{truncateOrderId(record.id)}</span>
                          <CopyButton val={record.id}>
                            {({ copied, copy }) => (
                              <IconClipboardFilled
                                className="cursor-pointer !ml-1.5 w-5 h-5 text-primary"
                                onClick={() => {
                                  copy();
                                  addNotification({
                                    message: "Order ID copied to clipboard",
                                    type: "success",
                                    duration: 2000,
                                  });
                                }}
                              />
                            )}
                          </CopyButton>
                        </div>
                      );
                    },
                  },
                  {
                    accessor: "createdAt",
                    title: "Order Date",
                    render(record, index) {
                      return (
                        <span>
                          {record.createdAt
                            ? new Date(record.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                }
                              )
                            : ""}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "stripe_session",
                    title: "Customer Email",
                    render(record, index) {
                      return (
                        <span>
                          {record.stripe_session?.customer_details?.email ||
                            "Unknown"}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "stripe_session",
                    title: "Total Amount",
                    render(record, index) {
                      return (
                        <span>
                          {record.stripe_session?.amount_total
                            ? formatPrice(
                                record.stripe_session.amount_total,
                                true
                              )
                            : "$0.00"}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "luluJobID",
                    title: "Lulu Job ID",
                    render(record, index) {
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
                    render(record, index) {
                      return (
                        <span
                          className={`capitalize ${
                            record.luluJobStatus === "ERROR"
                              ? "text-red-600 font-semibold"
                              : ""
                          }`}
                        >
                          {record.luluJobStatus || ""}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "status",
                    title: "Status",
                    render(record, index) {
                      return (
                        <span
                          className={`capitalize ${
                            record.status === "failed"
                              ? "text-red-600 font-semibold"
                              : ""
                          }`}
                        >
                          {record.status}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "actions",
                    title: "Actions",
                    render(record, index) {
                      return (
                        <Link to={`/controlpanel/store/orders/${record.id}`}>
                          <Button variant="primary" icon="IconEye" size="small">
                            View Details
                          </Button>
                        </Link>
                      );
                    },
                  },
                ]}
              />
              {lastPage?.meta?.has_more && (
                <div className="flex justify-center mt-4 w-full">
                  <Button
                    onClick={() => fetchNextPage()}
                    loading={isFetching || isInitialLoading}
                    variant="primary"
                    icon="IconDownload"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default StoreManager;
