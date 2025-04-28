import { Button, Icon, Label } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import useGlobalError from "../error/ErrorHooks";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import SupportCenterTable from "./SupportCenterTable";
import { PaginationWithItemsSelect } from "../util/PaginationWithItemsSelect";
import CopyButton from "../util/CopyButton";
import TicketStatusLabel from "./TicketStatusLabel";
import { Link } from "react-router-dom";

interface TicketUserOtherTicketsProps {
  ticket: SupportTicket;
}

const TicketUserOtherTickets: React.FC<TicketUserOtherTicketsProps> = ({
  ticket,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data: requesterOtherTickets, isFetching } = useQuery<SupportTicket[]>(
    {
      queryKey: ["userTickets", activePage, itemsPerPage, activeSort],
      queryFn: () =>
        getRequesterOtherTickets(activePage, itemsPerPage, activeSort),
      keepPreviousData: true,
      staleTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    setActivePage(1); // Reset to first page when itemsPerPage changes
  }, [itemsPerPage]);

  async function getRequesterOtherTickets(
    page: number,
    limit: number,
    sort: string,
  ) {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/requestor-other-tickets", {
        params: {
          page,
          limit,
          sort,
          currentTicketUUID: ticket.uuid,
          ...(ticket.user?.uuid
            ? { uuid: ticket.user?.uuid }
            : ticket.guest?.email
              ? { email: ticket.guest.email }
              : {}),
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
    if (!uuid) return;
    window.open(`/support/ticket/${uuid}`, "_blank");
  }

  const requestorName = useMemo(() => {
    if (!ticket) return "Unknown Requestor";
    if (ticket.guest) {
      return `${ticket.guest.firstName} ${ticket.guest.lastName}`;
    }
    if (ticket.user) {
      return `${ticket.user.firstName} ${ticket.user.lastName}`;
    }
    return "Unknown Requestor";
  }, [ticket]);

  return (
    <div className="flex flex-col rounded-md p-4 shadow-md bg-white h-fit space-y-1.5 border-blue-500 border mb-8">
      <p className="text-xl font-semibold text-center mb-2">
        {requestorName}
        {requestorName.endsWith("s") ? "'" : "'s"} Other Tickets
      </p>
      <SupportCenterTable<SupportTicket & { actions?: string }>
        tableProps={{
          className: "!mb-2",
        }}
        loading={isFetching}
        data={requesterOtherTickets || []}
        onRowClick={(record) => {
          openTicket(record.uuid);
        }}
        columns={[
          {
            accessor: "timeOpened",
            title: "Date Opened",
            render(record) {
              return format(parseISO(record.timeOpened), "MM/dd/yyyy");
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
            accessor: "assignedUsers",
            title: "Assigned To",
            render(record) {
              return record.assignedUsers ? (
                <p className="line-clamp-1 truncate">
                  {record.assignedUsers.map((u) => u.firstName).join(", ")}
                </p>
              ) : (
                <p>Unassigned</p>
              );
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
        ]}
      />
      <PaginationWithItemsSelect
        activePage={activePage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        setActivePageFn={setActivePage}
        setItemsPerPageFn={setItemsPerPage}
        totalLength={totalItems}
      />
    </div>
  );
};

export default TicketUserOtherTickets;
