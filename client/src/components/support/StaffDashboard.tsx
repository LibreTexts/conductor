import { useState, useEffect } from "react";
import { Button, Icon, Table } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO, set } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";
import { getRequesterText } from "../../utils/kbHelpers";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";

const StaffDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [openTickets, setOpenTickets] = useState<SupportTicket[]>([]);

  const [metricOpen, setMetricOpen] = useState<number>(0);
  const [metricAvgMins, setMetricAvgMins] = useState<number>(0);
  const [metricWeek, setMetricWeek] = useState<number>(0);

  useEffect(() => {
    getOpenTickets();
    getSupportMetrics();
  }, []);

  async function getOpenTickets() {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/open");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      setOpenTickets(res.data.tickets);
      setTotalItems(res.data.total);
      setTotalPages(Math.ceil(res.data.total / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
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
      <p className="text-4xl font-semibold">Staff Dashboard</p>
      <div className="flex flex-row justify-between w-full mt-6">
        <DashboardMetric metric={metricOpen.toString()} title="Open Tickets" />
        <DashboardMetric metric={`${metricAvgMins.toString()} mins`} title="Average Time to Resolution" />
        <DashboardMetric metric={metricWeek.toString()} title="Total Tickets This Week" />
      </div>
      <div className="mt-12">
        <p className="text-3xl font-semibold mb-2">Open Tickets</p>
        <PaginationWithItemsSelect
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setActivePageFn={setActivePage}
          setItemsPerPageFn={setItemsPerPage}
          totalLength={totalItems}
        />
        <Table celled className="mt-4">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Date Opened</Table.HeaderCell>
              <Table.HeaderCell>Subject</Table.HeaderCell>
              <Table.HeaderCell>Requester</Table.HeaderCell>
              <Table.HeaderCell>Assigned To</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {openTickets.map((ticket) => (
              <Table.Row key={ticket.uuid}>
                <Table.Cell>{ticket.uuid.slice(-7)}</Table.Cell>
                <Table.Cell>
                  {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
                </Table.Cell>
                <Table.Cell>{ticket.title}</Table.Cell>
                <Table.Cell>{getRequesterText(ticket)}</Table.Cell>
                <Table.Cell>
                  {ticket.assignedTo
                    ? ticket.assignedTo.firstName.toString()
                    : "Unassigned"}
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
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <PaginationWithItemsSelect
          activePage={activePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setActivePageFn={setActivePage}
          setItemsPerPageFn={setItemsPerPage}
          totalLength={totalItems}
        />
      </div>
    </div>
  );
};

export default StaffDashboard;
