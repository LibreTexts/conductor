import { useState, useEffect, lazy } from "react";
import { Button, Dropdown, Icon, Table } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { GenericKeyTextValueObj, SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO, set } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";
import { getRequesterText } from "../../utils/kbHelpers";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import { useTypedSelector } from "../../state/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
const AssignTicketModal = lazy(() => import("./AssignTicketModal"));
const SupportCenterSettingsModal = lazy(
  () => import("./SupportCenterSettingsModal")
);

type SupportMetrics = {
  totalOpenTickets: number;
  lastSevenTicketCount: number;
  avgDaysToClose: string;
};

const StaffDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
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

  const queryClient = useQueryClient();
  const { data: openTickets, isFetching } = useQuery<SupportTicket[]>({
    queryKey: [
      "openTickets",
      activePage,
      itemsPerPage,
      activeSort,
      assigneeFilter,
      priorityFilter,
      categoryFilter,
    ],
    queryFn: () =>
      getOpenTickets({
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

  const { data: supportMetrics } = useQuery<SupportMetrics>({
    queryKey: ["supportMetrics"],
    queryFn: getSupportMetrics,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  useEffect(() => {
    setActivePage(1); // Reset to first page when itemsPerPage changes
  }, [itemsPerPage])

  async function getOpenTickets({
    page,
    items,
    sort,
    assigneeFilter,
    priorityFilter,
    categoryFilter,
  }: {
    page: number;
    items: number;
    sort: string;
    assigneeFilter?: string;
    priorityFilter?: string;
    categoryFilter?: string;
  }) {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/open", {
        params: {
          page: page,
          limit: items,
          sort: sort,
          assignee: assigneeFilter,
          priority: priorityFilter,
          category: categoryFilter,
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
    } finally {
      setLoading(false);
    }
  }

  async function getSupportMetrics(): Promise<SupportMetrics> {
    try {
      setLoading(true);
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
        avgDaysToClose: avgDays.toPrecision(1) ?? "0",
      };
    } catch (err) {
      handleGlobalError(err);
      return {
        totalOpenTickets: 0,
        lastSevenTicketCount: 0,
        avgDaysToClose: "0",
      };
    } finally {
      setLoading(false);
    }
  }

  function openTicket(uuid: string) {
    window.open(`/support/ticket/${uuid}`, "_blank");
  }

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
      t.assignedUsers?.find((u) => u.uuid === uuid)
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
  }: {
    metric: string;
    title: string;
  }) => (
    <div className="flex flex-col bg-primary rounded-xl h-40 shadow-lg justify-center p-4 basis-1/4">
      <p className="text-4xl font-semibold text-white">{metric}</p>
      <p className="text-2xl font-semibold text-white">{title}</p>
    </div>
  );

  return (
    <div className="flex flex-col p-8" aria-busy={loading}>
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
        />
        <DashboardMetric
          metric={supportMetrics?.avgDaysToClose?.toString() + " days"}
          title="Average Time to Resolution"
        />
        <DashboardMetric
          metric={supportMetrics?.lastSevenTicketCount?.toString() ?? "0"}
          title="Total Tickets Past 7 Days"
        />
      </div>
      <div className="mt-12">
        <p className="text-3xl font-semibold mb-2">Open/In Progress Tickets</p>
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
        <div className="flex flex-row mt-2">
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
        <Table celled className="mt-2">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Date Opened</Table.HeaderCell>
              <Table.HeaderCell>Subject</Table.HeaderCell>
              <Table.HeaderCell>Category</Table.HeaderCell>
              <Table.HeaderCell>Requester</Table.HeaderCell>
              <Table.HeaderCell>Assigned To</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!isFetching &&
              openTickets?.map((ticket) => (
                <Table.Row key={ticket.uuid}>
                  <Table.Cell>{ticket.uuid.slice(-7)}</Table.Cell>
                  <Table.Cell>
                    {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
                  </Table.Cell>
                  <Table.Cell>{ticket.title}</Table.Cell>
                  <Table.Cell>
                    {getPrettySupportTicketCategory(ticket.category)}
                  </Table.Cell>
                  <Table.Cell>{getRequesterText(ticket)}</Table.Cell>
                  <Table.Cell>
                    {ticket.assignedUsers
                      ? ticket.assignedUsers.map((u) => u.firstName).join(", ")
                      : "Unassigned"}
                  </Table.Cell>
                  <Table.Cell>
                    {capitalizeFirstLetter(ticket.priority)}
                  </Table.Cell>
                  <Table.Cell>
                    <TicketStatusLabel status={ticket.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      color="blue"
                      size="tiny"
                      onClick={() => openTicket(ticket.uuid)}
                    >
                      <Icon name="eye" />
                      View
                    </Button>
                    {ticket.status === "open" && (
                      <Button
                        color="green"
                        size="tiny"
                        onClick={() => openAssignModal(ticket.uuid)}
                      >
                        <Icon name="user plus" />
                        Assign
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            {isFetching && <LoadingSpinner />}
          </Table.Body>
        </Table>
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
