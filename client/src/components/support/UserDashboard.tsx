import { useState, useEffect } from "react";
import { Button, Icon, Table, TableBody } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket } from "../../types";
import axios from "axios";
import { format, parseISO } from "date-fns";
import TicketStatusLabel from "./TicketStatusLabel";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "../LoadingSpinner";

const UserDashboard = () => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data: userTickets, isFetching } = useQuery<SupportTicket[]>({
    queryKey: ["userTickets", activePage, itemsPerPage, activeSort],
    queryFn: () => getUserTickets(activePage, itemsPerPage, activeSort),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  useEffect(() => {
    setActivePage(1); // Reset to first page when itemsPerPage changes
  }, [itemsPerPage])

  async function getUserTickets(page: number, limit: number, sort: string) {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/user", {
        params: {
          page,
          limit,
          sort,
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

      return res.data.tickets;
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function openTicket(uuid: string) {
    window.open(`/support/ticket/${uuid}`, "_blank");
  }
  console.log(totalItems);
  return (
    <div className="flex flex-col p-8" aria-busy={loading}>
      <p className="text-4xl font-semibold">My Support Tickets</p>
      <div className="mt-12">
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
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          {totalItems>0 &&
          <Table.Body>
            {isFetching && <LoadingSpinner />}
            {!isFetching &&
              userTickets?.map((ticket) => (
                <Table.Row key={ticket.uuid}>
                  <Table.Cell>{ticket.uuid.slice(-7)}</Table.Cell>
                  <Table.Cell>
                    {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
                  </Table.Cell>
                  <Table.Cell>{ticket.title}</Table.Cell>
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
          </Table.Body>}
          {totalItems==0 && <TableBody>
            <tr className = "text-center">
              <td colSpan={5}>
              No Tickets Found
              </td>
            </tr>
            </TableBody>}
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
    </div>
  );
};

export default UserDashboard;
