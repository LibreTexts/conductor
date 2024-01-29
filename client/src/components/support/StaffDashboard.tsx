import { useState, useEffect, lazy } from "react";
import { Button, Icon, Table } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO, set } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";
import { getRequesterText } from "../../utils/kbHelpers";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import { useTypedSelector } from "../../state/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
const AssignTicketModal = lazy(() => import("./AssignTicketModal"));
const SupportCenterSettingsModal = lazy(
  () => import("./SupportCenterSettingsModal")
);

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
  const [metricOpen, setMetricOpen] = useState<number>(0);
  const [metricAvgMins, setMetricAvgMins] = useState<number>(0);
  const [metricWeek, setMetricWeek] = useState<number>(0);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");

  const queryClient = useQueryClient();

  const { data: openTickets, isFetching } = useQuery<SupportTicket[]>({
    queryKey: ["openTickets", activePage, itemsPerPage, activeSort],
    queryFn: () => getOpenTickets(activePage, itemsPerPage, activeSort),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  useEffect(() => {
    getSupportMetrics();
  }, []);

  async function getOpenTickets(page: number, items: number, sort: string) {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/open", {
        params: {
          page: page,
          limit: items,
          sort: sort,
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
      return (res.data.tickets as SupportTicket[]) ?? [];
    } catch (err) {
      handleGlobalError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function getSupportMetrics() {
    try {
      setLoading(true);
      const res = await axios.get("/support/metrics");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.metrics) {
        throw new Error("Invalid response from server");
      }

      setMetricOpen(res.data.metrics.totalOpenTickets ?? 0);
      setMetricAvgMins(res.data.metrics.avgMinsToClose ?? 0);
      setMetricWeek(res.data.metrics.lastSevenTicketCount ?? 0);
    } catch (err) {
      handleGlobalError(err);
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
          <Button color="blue" size="tiny" basic onClick={() => window.location.href = '/support/closed'}>
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
          metric={metricOpen.toString()}
          title="Open/In Progress Tickets"
        />
        <DashboardMetric
          metric={`${metricAvgMins.toString()} mins`}
          title="Average Time to Resolution"
        />
        <DashboardMetric
          metric={metricWeek.toString()}
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
          sortOptions={["opened", "priority", "status"]}
          activeSort={activeSort}
          setActiveSortFn={setActiveSort}
        />
        <Table celled className="mt-4">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Date Opened</Table.HeaderCell>
              <Table.HeaderCell>Subject</Table.HeaderCell>
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
          sortOptions={["opened", "priority", "status"]}
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
