import { useState, useEffect } from "react";
import { Button, Icon, Table } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";

const StaffDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [openTickets, setOpenTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    getOpenTickets();
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
        <DashboardMetric metric="12" title="Open Tickets" />
        <DashboardMetric metric="54 mins" title="Average Time to Resolution" />
        <DashboardMetric metric="24" title="Total Tickets This Week" />
      </div>
      <div className="mt-12">
        <p className="text-3xl font-semibold">Open Tickets</p>
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
                <Table.Cell>{ticket.guest?.firstName}</Table.Cell>
                <Table.Cell></Table.Cell>
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
      </div>
    </div>
  );
};

export default StaffDashboard;
