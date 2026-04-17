import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { capitalizeFirstLetter, truncateString } from "../util/HelperFunctions";
import useGlobalError from "../error/ErrorHooks";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { TicketStatusPill } from "./TicketInfoPill";
import { Card, Heading } from "@libretexts/davis-react";
import { type Table, type ColumnDef, type ColumnFiltersState, type SortingState, DataTable } from "@libretexts/davis-react-table";

interface TicketUserOtherTicketsProps {
  ticket: SupportTicket;
}

const columns: ColumnDef<SupportTicket>[] = [
  {
    accessorKey: "queue",
    header: "Queue",
    cell: ({ getValue }) => {
      const queue = getValue<{ name: string }>();
      return queue ? queue.name : "--";
    }
  },
  {
    accessorKey: "timeOpened",
    header: "Date Opened",
    cell: ({ getValue }) => {
      const timeOpened = getValue<string>();
      return timeOpened ? format(parseISO(timeOpened), "MM/dd/yyyy") : "--";
    }
  },
  {
    accessorKey: "title",
    header: "Subject",
    cell: ({ getValue }) => {
      const title = getValue<string>();
      return (
        <p className="!w-full !max-w-[40rem] break-words truncate">
          {truncateString(title, 80)}{" "}
        </p >
      )
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => {
      const category = getValue<string>();
      return category ? getPrettySupportTicketCategory(category) : "--";
    }
  },
  {
    accessorKey: "assignedUsers",
    header: "Assigned To",
    cell: ({ row }) => {
      const record = row.original;
      return record.assignedUsers &&
        Array.isArray(record.assignedUsers) &&
        record.assignedUsers.length > 0 ? (
        <p className="line-clamp-1 truncate">
          {record.assignedUsers.map((u) => u.firstName).join(", ")}
        </p>
      ) : (
        <p>Unassigned</p>
      );
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ getValue }) => {
      const priority = getValue<string>();
      return priority ? capitalizeFirstLetter(priority) : "--";
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      return <TicketStatusPill status={getValue<string>()} />;
    },
  },
]

const TicketUserOtherTickets: React.FC<TicketUserOtherTicketsProps> = ({
  ticket,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [sortChoice, setSortChoice] = useState<string>("opened");

  const tableRef = useRef<Table<SupportTicket> | null>(null);

  const { data: requesterOtherTickets, isFetching } = useQuery<SupportTicket[]>(
    {
      queryKey: ["userTickets", activePage, itemsPerPage, sortChoice],
      queryFn: () =>
        getRequesterOtherTickets(activePage, itemsPerPage, sortChoice),
      keepPreviousData: true,
      staleTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    setActivePage(1); // Reset to first page when itemsPerPage changes
  }, [itemsPerPage]);

  async function getRequesterOtherTickets(
    page: number,
    limit: number,
    sort: string
  ) {
    try {
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

      return res.data.tickets;
    } catch (err) {
      handleGlobalError(err);
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

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  return (
    <Card variant="elevated" className="!border-blue-500">
      <Card.Header>
        <Heading level={4} align="center">
          {requestorName}
          {requestorName.endsWith("s") ? "'" : "'s"} Other Tickets
        </Heading>
      </Card.Header>
      <Card.Body className="py-4">
        <DataTable<SupportTicket>
          data={requesterOtherTickets || []}
          columns={columns}
          loading={isFetching}
          density="compact"
          onRowClick={(record) => {
            openTicket(record.uuid)
          }}
          //enableSorting
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          onTableReady={(table) => (tableRef.current = table)}
          tableOptions={{
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            rowCount: totalItems,
            state: {
              pagination: paginationState,
              sorting,
            },
            onPaginationChange: (updater) => {
              const nextPagination =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;

              setActivePage(nextPagination.pageIndex + 1);
              setItemsPerPage(nextPagination.pageSize);
            },
            // onSortingChange: (updater) => {
            //   const nextSorting =
            //     typeof updater === "function" ? updater(sorting) : updater;

            //   setSorting(nextSorting);
            //   setActivePage(1);

            //   const [firstSort] = nextSorting;
            //   setSortChoice(
            //     firstSort ? (SORT_COLUMN_MAP[firstSort.id] ?? "first") : "first"
            //   );
            // },
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default TicketUserOtherTickets;
