import { useState } from "react";
import { Card, Heading } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { SupportTicket } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";
import { getPrettySupportTicketCategory } from "../../../utils/supportHelpers";
import { TicketStatusPill } from "../../support/TicketInfoPill";

interface UserSupportTicketsProps {
  uuid: string;
}

const columns: ColumnDef<SupportTicket>[] = [
  {
    id: "queue",
    header: "Queue",
    accessorFn: (row) => row.queue?.name || "N/A",
  },
  {
    accessorKey: "timeOpened",
    header: "Date Opened",
    cell: ({ getValue }) => format(parseISO(getValue<string>()), "MM/dd/yyyy"),
  },
  {
    accessorKey: "title",
    header: "Subject",
    cell: ({ getValue }) => (
      <span className="line-clamp-1 break-words">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) =>
      getPrettySupportTicketCategory(getValue<string>() || ""),
  },
  {
    accessorKey: "assignedUsers",
    header: "Assigned To",
    cell: ({ row }) => {
      const assigned = row.original.assignedUsers;
      return assigned && Array.isArray(assigned) && assigned.length > 0 ? (
        <span className="line-clamp-1">
          {assigned.map((u) => u.firstName).join(", ")}
        </span>
      ) : (
        <span>Unassigned</span>
      );
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ getValue }) => capitalizeFirstLetter(getValue<string>() || ""),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <TicketStatusPill status={row.original.status} />,
  },
];

const UserSupportTickets: React.FC<UserSupportTicketsProps> = ({ uuid }) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort] = useState<string>("opened");
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isFetching } = useQuery<SupportTicket[]>({
    queryKey: ["user-tickets", uuid, activePage, itemsPerPage, activeSort],
    queryFn: () => getUserTickets(),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: !!uuid,
  });

  async function getUserTickets() {
    try {
      if (!uuid) return [];
      const res = await api.getUserSupportTickets({
        uuid,
        page: activePage,
        limit: itemsPerPage,
        sort: activeSort,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      setTotalItems(res.data.total);
      return res.data.tickets;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  function openTicket(ticketUUID: string) {
    if (!ticketUUID) return;
    window.open(`/support/ticket/${ticketUUID}`, "_blank");
  }

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  return (
    <Card>
      <Card.Header>
        <Heading level={3}>Support Tickets</Heading>
      </Card.Header>
      <Card.Body>
        <DataTable<SupportTicket>
          data={data || []}
          columns={columns}
          loading={isFetching}
          density="compact"
          caption="Support tickets opened by this user"
          onRowClick={(record) => openTicket(record.uuid)}
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[5, 10, 25]}
          tableOptions={{
            manualPagination: true,
            rowCount: totalItems,
            state: { pagination: paginationState },
            onPaginationChange: (updater) => {
              const next =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setActivePage(next.pageIndex + 1);
              setItemsPerPage(next.pageSize);
            },
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default UserSupportTickets;
