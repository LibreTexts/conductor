import { useState } from "react";
import { SupportTicket } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import SupportCenterTable from "../../support/SupportCenterTable";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { PaginationWithItemsSelect } from "../../util/PaginationWithItemsSelect";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";
import { getPrettySupportTicketCategory } from "../../../utils/supportHelpers";
import { Header } from "semantic-ui-react";
import { TicketStatusPill } from "../../support/TicketInfoPill";

interface UserSupportTicketsProps {
  uuid: string;
}

const UserSupportTickets: React.FC<UserSupportTicketsProps> = ({ uuid }) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isFetching } = useQuery<SupportTicket[]>(
    {
      queryKey: ["user-tickets", uuid, activePage, itemsPerPage, activeSort],
      queryFn: () => getUserTickets(),
      keepPreviousData: true,
      staleTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      enabled: !!uuid,
    }
  );

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
      setTotalPages(Math.ceil(res.data.total / itemsPerPage));
      return res.data.tickets;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  function openTicket(uuid: string) {
    if (!uuid) return;
    window.open(`/support/ticket/${uuid}`, "_blank");
  }

  return (
    <div className="flex flex-col rounded-md p-4 shadow-md bg-white h-fit space-y-1.5 mb-8">
      <div className="flex justify-between items-center mb-4 border-b border-slate-300 py-1.5">
        <Header as="h3" className="!m-0">
          Support Tickets
        </Header>
      </div>
      <SupportCenterTable<SupportTicket & { actions?: string }>
        tableProps={{
          className: "!mb-2",
        }}
        loading={isFetching}
        data={data || []}
        onRowClick={(record) => {
          openTicket(record.uuid);
        }}
        columns={[
          {
            accessor: "queue.name",
            title: "Queue",
            render(record) {
              return record.queue?.name || "N/A";
            }
          },
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
              return getPrettySupportTicketCategory(record.category || "");
            },
          },
          {
            accessor: "assignedUsers",
            title: "Assigned To",
            render(record) {
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
            accessor: "priority",
            render(record) {
              return capitalizeFirstLetter(record.priority || "");
            },
          },
          {
            accessor: "status",
            render(record) {
              return <TicketStatusPill status={record.status} />;
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

export default UserSupportTickets;
