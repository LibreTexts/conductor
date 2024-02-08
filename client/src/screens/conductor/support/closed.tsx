import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, lazy, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import { isSupportStaff } from "../../../utils/supportHelpers";
import { PaginationWithItemsSelect } from "../../../components/util/PaginationWithItemsSelect";
import { Button, Icon, Table } from "semantic-ui-react";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { capitalizeFirstLetter } from "../../../components/util/HelperFunctions";
import { format, parseISO } from "date-fns";
import { getRequesterText } from "../../../utils/kbHelpers";
import { SupportTicket } from "../../../types";
import axios from "axios";
import useGlobalError from "../../../components/error/ErrorHooks";

const SupportDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [closedTickets, setClosedTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    document.title = "LibreTexts | Closed Tickets";
    getClosedTickets();
  }, []);

  //   useEffect(() => {
  //     if (!isSupportStaff(user)) {
  //       window.location.href = "/support"; // redirect to support center if not staff
  //       return;
  //     }
  //   }, [user])

  useEffect(() => {
    getClosedTickets();
  }, [activePage, itemsPerPage, activeSort]);

  async function getClosedTickets() {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/closed", {
        params: {
          page: activePage,
          limit: itemsPerPage,
          sort: activeSort,
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      setTotalItems(res.data.total);
      setTotalPages(Math.ceil(res.data.total / itemsPerPage));
      setClosedTickets(res.data.tickets);
    } catch (err) {
      handleGlobalError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  function openTicket(uuid: string) {
    window.open(`/support/ticket/${uuid}`, "_blank");
  }

  return (
    <DefaultLayout>
      <div className="flex flex-col p-8" aria-busy={loading}>
        <div className="flex flex-row justify-between items-center">
          <p className="text-4xl font-semibold">Closed Tickets</p>
        </div>
        <div className="mt-12">
          <PaginationWithItemsSelect
            activePage={activePage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setActivePageFn={setActivePage}
            setItemsPerPageFn={setItemsPerPage}
            totalLength={totalItems}
            sort={true}
            sortOptions={["opened", "closed", "priority"]}
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
                <Table.HeaderCell>Date Closed</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {!loading &&
                closedTickets?.map((ticket) => (
                  <Table.Row key={ticket.uuid}>
                    <Table.Cell>{ticket.uuid.slice(-7)}</Table.Cell>
                    <Table.Cell>
                      {format(
                        parseISO(ticket.timeOpened),
                        "MM/dd/yyyy hh:mm aa"
                      )}
                    </Table.Cell>
                    <Table.Cell>{ticket.title}</Table.Cell>
                    <Table.Cell>{getRequesterText(ticket)}</Table.Cell>
                    <Table.Cell>
                      {ticket.assignedUsers
                        ? ticket.assignedUsers
                            .map((u) => u.firstName)
                            .join(", ")
                        : "Unassigned"}
                    </Table.Cell>
                    <Table.Cell>
                      {capitalizeFirstLetter(ticket.priority)}
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
              {loading && <LoadingSpinner />}
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
            sortOptions={["opened", "closed", "priority"]}
            activeSort={activeSort}
            setActiveSortFn={setActiveSort}
          />
        </div>
      </div>
    </DefaultLayout>
  );
};

export default SupportDashboard;
