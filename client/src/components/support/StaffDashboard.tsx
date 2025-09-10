import { useState, useEffect, lazy } from "react";
import { Button, Dropdown, Icon, Input } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { GenericKeyTextValueObj, SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";
import { getRequesterText } from "../../utils/kbHelpers";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import { useTypedSelector } from "../../state/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { useNotifications } from "../../context/NotificationContext";
import { Link } from "react-router-dom";
import SupportCenterTable from "./SupportCenterTable";
import useDebounce from "../../hooks/useDebounce";
import LoadingSpinner from "../LoadingSpinner";
const AssignTicketModal = lazy(() => import("./AssignTicketModal"));
const SupportCenterSettingsModal = lazy(
  () => import("./SupportCenterSettingsModal"),
);

type SupportMetrics = {
  totalOpenTickets: number;
  lastSevenTicketCount: number;
  avgDaysToClose: string;
};

const StaffDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const user = useTypedSelector((state) => state.user);
  const { debounce } = useDebounce();

  const [queryInputString, setQueryInputString] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<{
    assignee: GenericKeyTextValueObj<string>[];
    priority: GenericKeyTextValueObj<string>[];
    category: GenericKeyTextValueObj<string>[];
  }>({
    assignee: [],
    priority: [],
    category: [],
  });

  const { data: openTickets, isFetching } = useQuery<SupportTicket[]>({
    queryKey: [
      "openTickets",
      activePage,
      itemsPerPage,
      activeSort,
      assigneeFilter,
      priorityFilter,
      categoryFilter,
      query,
    ],
    queryFn: () =>
      getOpenTickets({
        query: queryInputString,
        page: activePage,
        items: itemsPerPage,
        sort: activeSort,
        assigneeFilter,
        priorityFilter,
        categoryFilter,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const { data: supportMetrics, isFetching: isFetchingMetrics } =
    useQuery<SupportMetrics>({
      queryKey: ["supportMetrics"],
      queryFn: getSupportMetrics,
      staleTime: 1000 * 60 * 2, // 2 minutes
    });

  useEffect(() => {
    setActivePage(1); // Reset to first page when itemsPerPage changes
  }, [itemsPerPage]);

  async function getOpenTickets({
    query,
    page,
    items,
    sort,
    assigneeFilter,
    priorityFilter,
    categoryFilter,
  }: {
    query: string;
    page: number;
    items: number;
    sort: string;
    assigneeFilter?: string;
    priorityFilter?: string;
    categoryFilter?: string;
  }) {
    try {
      const res = await axios.get("/support/ticket/open", {
        params: {
          ...(query?.length > 3 && { query: query }),
          page: page,
          limit: items,
          sort: sort,
          ...(assigneeFilter && { assignee: assigneeFilter }),
          ...(priorityFilter && { priority: priorityFilter }),
          ...(categoryFilter && { category: categoryFilter }),
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      setTotalItems(res.data.total);
      setTotalPages(Math.ceil(res.data.total / items));

      const CLEAR_OPTION = { key: "clear", text: "Clear", value: "" };
      if (res.data.filters) {
        const _assignee = Array.isArray(res.data.filters.assignee)
          ? [CLEAR_OPTION, ...res.data.filters.assignee]
          : [];
        const _priority = Array.isArray(res.data.filters.priority)
          ? [CLEAR_OPTION, ...res.data.filters.priority]
          : [];
        const _category = Array.isArray(res.data.filters.category)
          ? [CLEAR_OPTION, ...res.data.filters.category]
          : [];

        setFilterOptions({
          assignee: _assignee,
          priority: _priority,
          category: _category,
        });
      } else {
        setFilterOptions({
          assignee: [],
          priority: [],
          category: [],
        });
      }

      return (res.data.tickets as SupportTicket[]) ?? [];
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  async function getSupportMetrics(): Promise<SupportMetrics> {
    try {
      const res = await axios.get("/support/metrics");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.metrics) {
        throw new Error("Invalid response from server");
      }

      // Convert avgMins to days
      const avgMins = res.data.metrics.avgMinsToClose ?? 0;
      const avgDays = avgMins / (60 * 24);
      return {
        totalOpenTickets: res.data.metrics.totalOpenTickets ?? 0,
        lastSevenTicketCount: res.data.metrics.lastSevenTicketCount ?? 0,
        avgDaysToClose: Math.floor(avgDays).toString() ?? "0",
      };
    } catch (err) {
      handleGlobalError(err);
      return {
        totalOpenTickets: 0,
        lastSevenTicketCount: 0,
        avgDaysToClose: "0",
      };
    }
  }

  const debouncedQueryUpdate = debounce(
    (searchString: string) => setQuery(searchString),
    300,
  );

  function openAssignModal(ticketId: string) {
    setSelectedTicketId(ticketId);
    setShowAssignModal(true);
  }

  function onCloseAssignModal() {
    setShowAssignModal(false);
    setSelectedTicketId("");
    queryClient.invalidateQueries(["openTickets"]);
  }

  function handleFilterChange(filter: string, value: string) {
    setActivePage(1); // Reset to first page on filter change
    switch (filter) {
      case "assignee":
        setAssigneeFilter(value);
        break;
      case "priority":
        setPriorityFilter(value);
        break;
      case "category":
        setCategoryFilter(value);
        break;
      default:
        break;
    }
  }

  function getAssigneeName(uuid: string) {
    const user = openTickets?.find((t) =>
      t.assignedUsers?.find((u) => u.uuid === uuid),
    );
    if (user) {
      return user.assignedUsers?.find((u) => u.uuid === uuid)?.firstName;
    } else {
      return "";
    }
  }

  const DashboardMetric = ({
    metric,
    title,
    loading = false,
  }: {
    metric: string;
    title: string;
    loading?: boolean;
  }) => (
    <div className="flex flex-col bg-primary rounded-xl h-40 shadow-lg justify-center p-4 basis-1/4">
      <p className="text-4xl font-semibold text-white">{loading ? <LoadingSpinner fullscreen={false} iconOnly light/> : metric}</p>
      <p className="text-2xl font-semibold text-white">{title}</p>
    </div>
  );

  return (
    <div className="flex flex-col p-8">
      <div className="flex flex-row justify-between items-center">
        <p className="text-4xl font-semibold">Staff Dashboard</p>
        <div className="flex flex-row">
          <Button
            color="blue"
            size="tiny"
            basic
            onClick={() => (window.location.href = "/support/closed")}
          >
            <Icon name="check circle outline" />
            View Closed
          </Button>
          {user.isSuperAdmin && (
            <Button
              color="blue"
              size="tiny"
              onClick={() => setShowSettingsModal(true)}
              basic
              className="ml-2"
            >
              <Icon name="settings" />
              Support Center Settings
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-row justify-between w-full mt-6">
        <DashboardMetric
          metric={supportMetrics?.totalOpenTickets?.toString() ?? "0"}
          title="Open/In Progress Tickets"
          loading={isFetchingMetrics}
        />
        <DashboardMetric
          metric={(supportMetrics?.avgDaysToClose?.toString() ?? 0) + " days"}
          title="Average Time to Resolution"
          loading={isFetchingMetrics}
        />
        <DashboardMetric
          metric={supportMetrics?.lastSevenTicketCount?.toString() ?? "0"}
          title="New Tickets Past 7 Days"
          loading={isFetchingMetrics}
        />
      </div>
      <div className="mt-12">
        <p className="text-3xl font-semibold mb-2">Open/In Progress Tickets</p>
        <div className="flex flex-row my-2 justify-between">
          <div className="flex flex-row items-center">
            <Dropdown
              text={
                assigneeFilter
                  ? getAssigneeName(assigneeFilter)
                  : "Filter by Assignee"
              }
              icon="users"
              floating
              labeled
              button
              className="icon"
              basic
            >
              <Dropdown.Menu>
                {filterOptions.assignee.map((a) => (
                  <Dropdown.Item
                    key={a.key}
                    onClick={() => handleFilterChange("assignee", a.value)}
                  >
                    {a.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text={
                priorityFilter
                  ? capitalizeFirstLetter(priorityFilter)
                  : "Filter by Priority"
              }
              icon="exclamation triangle"
              floating
              labeled
              button
              className="icon !ml-3"
              basic
            >
              <Dropdown.Menu>
                {filterOptions.priority.map((p) => (
                  <Dropdown.Item
                    key={p.key}
                    onClick={() => handleFilterChange("priority", p.value)}
                  >
                    {p.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text={
                categoryFilter
                  ? capitalizeFirstLetter(categoryFilter)
                  : "Filter by Category"
              }
              icon="filter"
              floating
              labeled
              button
              className="icon !ml-3"
              basic
            >
              <Dropdown.Menu>
                {filterOptions.category.map((c) => (
                  <Dropdown.Item
                    key={c.key}
                    onClick={() => handleFilterChange("category", c.value)}
                  >
                    {c.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <Input
            type="text"
            icon="search"
            loading={isFetching}
            className="min-w-[30rem]"
            placeholder="ID, title, requester name, email, etc."
            value={queryInputString}
            onChange={(e) => {
              setQueryInputString(e.target.value);
              debouncedQueryUpdate(e.target.value);
            }}
          />
        </div>
        <PaginationWithItemsSelect
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setActivePageFn={setActivePage}
          setItemsPerPageFn={setItemsPerPage}
          totalLength={totalItems}
          sort={true}
          sortOptions={["opened", "priority", "status", "category"]}
          activeSort={activeSort}
          setActiveSortFn={setActiveSort}
        />
        <SupportCenterTable<SupportTicket & { actions?: string }>
          loading={isFetching}
          data={openTickets}
          className="!my-4"
          columns={[
            {
              accessor: "uuid",
              title: "ID",
              copyButton: true,
              render(record, index) {
                return record.uuid.slice(-7);
              },
            },
            {
              accessor: "timeOpened",
              title: "Date Opened",
              render(record) {
                return format(
                  parseISO(record.timeOpened),
                  "MM/dd/yyyy hh:mm aa",
                );
              },
            },
            {
              accessor: "title",
              title: "Subject",
              className: "!w-full !max-w-[40rem] break-words truncate",
              render(record) {
                return record.title;
              },
            },
            {
              accessor: "category",
              title: "Category",
              render(record) {
                return getPrettySupportTicketCategory(record.category);
              },
            },
            {
              accessor: "user",
              title: "Requester",
              render(record) {
                return getRequesterText(record);
              },
            },
            {
              accessor: "assignedUsers",
              title: "Assigned To",
              render(record) {
                return record.assignedUsers
                  ? record.assignedUsers.map((u) => u.firstName).join(", ")
                  : "Unassigned";
              },
            },
            {
              accessor: "priority",
              render(record) {
                return capitalizeFirstLetter(record.priority);
              },
            },
            {
              accessor: "status",
              render(record) {
                return <TicketStatusLabel status={record.status} />;
              },
            },
            {
              accessor: "actions",
              render(record) {
                return (
                  <div className="flex flex-row whitespace-nowrap">
                    <Button
                      color="blue"
                      size="tiny"
                      to={`/support/ticket/${record.uuid}`}
                      target="_blank"
                      as={Link}
                      className="inline-flex"
                    >
                      <Icon name="eye" />
                      View
                    </Button>
                    {record.status === "open" && (
                      <Button
                        color="green"
                        size="tiny"
                        onClick={() => openAssignModal(record.uuid)}
                        className="inline-flex !ml-2"
                      >
                        <Icon name="user plus" />
                        Assign
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
        <PaginationWithItemsSelect
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setActivePageFn={setActivePage}
          setItemsPerPageFn={setItemsPerPage}
          totalLength={totalItems}
          sort={true}
          sortOptions={["opened", "priority", "status", "category"]}
          activeSort={activeSort}
          setActiveSortFn={setActiveSort}
        />
      </div>
      <SupportCenterSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      {selectedTicketId && (
        <AssignTicketModal
          open={showAssignModal}
          onClose={onCloseAssignModal}
          ticketId={selectedTicketId}
        />
      )}
    </div>
  );
};

export default StaffDashboard;
