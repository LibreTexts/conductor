import { IconUser } from "@tabler/icons-react";
import { SupportTicket } from "../../types";
import Checkbox from "../NextGenInputs/Checkbox";
import { format, parseISO } from "date-fns";
import { getRequesterText } from "../../utils/kbHelpers";
import { truncateString } from "../util/HelperFunctions";
import { useEffect, useState } from "react";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { TicketPriorityPill, TicketStatusPill } from "./TicketInfoPill";
import { useSupportCenterContext } from "../../context/SupportCenterContext";

interface TicketTableProps {
  data: SupportTicket[];
  showSelect?: boolean;
  showAssigned?: boolean;
  showQueue?: boolean;
  forceCategoryColumn?: boolean;
  forcePriorityColumn?: boolean;
  loading?: boolean;
  placeholderRows?: number;
}

const TicketTable: React.FC<TicketTableProps> = ({
  data,
  showSelect,
  showAssigned,
  forceCategoryColumn,
  forcePriorityColumn,
  loading,
  placeholderRows = 10,
}) => {
  const { setSelectedTickets, selectedQueueObject } = useSupportCenterContext();
  const [allSelected, setAllSelected] = useState(false);
  const [withChecked, setWithChecked] = useState<
    (SupportTicket & {
      checked: boolean;
    })[]
  >([]);

  useEffect(() => {
    setWithChecked(data.map((ticket) => ({ ...ticket, checked: false })));
    setSelectedTickets([]);
  }, [data]);

  useEffect(() => {
    if (allSelected) {
      setWithChecked(data.map((ticket) => ({ ...ticket, checked: true })));
      setSelectedTickets(data.map((ticket) => ticket.uuid));
    } else {
      setWithChecked(data.map((ticket) => ({ ...ticket, checked: false })));
      setSelectedTickets([]);
    }
  }, [allSelected]);

  const updateChecked = (uuid: string, checked: boolean) => {
    const ticket = withChecked.find((t) => t.uuid === uuid);
    if (ticket) {
      setWithChecked((prev) =>
        prev.map((t) => (t.uuid === uuid ? { ...t, checked } : t))
      );
      if (checked) {
        setSelectedTickets((prev) => [...prev, uuid]);
      } else {
        setSelectedTickets((prev) => prev.filter((id) => id !== uuid));
      }
    }
  };

  const TableContentPlaceholder = ({ rows }: { rows: number }) => {
    return (
      <>
        {Array.from({ length: rows }).map((_, idx) => (
          <tr
            key={idx}
            className="border-b border-b-gray-200 align-middle animate-pulse"
          >
            <td className="pl-5 pr-2 py-3">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
            </td>
            <td className="">
              <div className="flex flex-col py-3 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            </td>
            {(selectedQueueObject?.has_categories || forceCategoryColumn) && (
              <td className="pr-3">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </td>
            )}
            <td className="pr-3">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </td>
            {(selectedQueueObject?.has_priorities || forcePriorityColumn) && (
              <td className="pr-10">
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              </td>
            )}
            <td className="pr-10">
              <div className="h-6 bg-gray-200 rounded-full w-24"></div>
            </td>
            {showAssigned && (
              <td className="pr-5">
                <div className="h-4 bg-gray-200 rounded w-28"></div>
              </td>
            )}
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="w-full h-screen overflow-auto border border-gray-200 rounded-lg !bg-white">
      <table className="w-full text-left whitespace-nowrap !bg-white">
        <thead className="sticky top-0 z-10 border-b border-r border-slate-200 text-sm/6  text-gray-900 bg-gray-100 font-semibold shadow-sm">
          <tr className="">
            {showSelect && (
              <th scope="col" className="py-2 pl-5">
                <Checkbox
                  checked={allSelected}
                  onChange={(checked) => setAllSelected(checked)}
                  name="select-all-tickets"
                  large
                />
              </th>
            )}
            <th scope="col" className={`py-2 ${showSelect ? "lg:w-5/12" : "pl-5 lg:w-6/12"}`}>
              Title
            </th>
            {(selectedQueueObject?.has_categories || forceCategoryColumn) && (
              <th scope="col" className="py-2">
                Category
              </th>
            )}
            <th scope="col" className="py-2">
              Requester
            </th>
            {(selectedQueueObject?.has_priorities || forcePriorityColumn) && (
              <th scope="col" className="py-2">
                Priority
              </th>
            )}
            <th scope="col" className="py-2">
              Status
            </th>
            {showAssigned && (
              <th scope="col" className="py-2">
                Assigned
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 !bg-white">
          {loading && <TableContentPlaceholder rows={placeholderRows} />}
          {!loading &&
            withChecked.length > 0 &&
            withChecked.map((ticket, idx) => (
              <a
                key={ticket.uuid}
                href={`/support/ticket/${ticket.uuid}`}
                target="_blank"
                className="contents text-black"
              >
                <div className="relative left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                <tr
                  className={`hover:bg-gray-50 cursor-pointer transition-colors border-b border-b-gray-200 align-middle`}
                >
                  {showSelect && (
                    <td className="pl-5 pr-2">
                      <Checkbox
                        name={`select-ticket-${ticket.uuid}`}
                        large
                        checked={ticket.checked}
                        onChange={(checked) => {
                          updateChecked(ticket.uuid, checked);
                        }}
                      />
                    </td>
                  )}
                  <td className={`${showSelect ? "" : "pl-5"}`}>
                    <div className="flex flex-col py-3">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 text-lg truncate max-w-2xl">
                        {truncateString(ticket.title, 80)}{" "}
                      </p>
                      <p className="text-sm text-gray-600 font-mono pl-0.5">
                        {format(
                          parseISO(ticket.timeOpened),
                          "MM/dd/yyyy hh:mm aa"
                        )}{" "}
                        &middot; #{ticket.uuid.slice(-7)}
                      </p>
                    </div>
                  </td>
                  {(selectedQueueObject?.has_categories ||
                    forceCategoryColumn) && (
                    <td className="text-sm truncate max-w-[10rem] pr-3">
                      {getPrettySupportTicketCategory(ticket.category || "")}
                    </td>
                  )}
                  <td className="max-w-[15rem]">
                    <div className="flex items-center space-x-1 text-sm pr-3">
                      <IconUser className="w-4 h-4" />
                      <p className="truncate">{getRequesterText(ticket)}</p>
                    </div>
                  </td>
                  {(selectedQueueObject?.has_priorities ||
                    forcePriorityColumn) && (
                    <td className="pr-10">
                      <TicketPriorityPill priority={ticket.priority || ""} />
                    </td>
                  )}
                  <td className="pr-10">
                    <TicketStatusPill status={ticket.status} />
                  </td>
                  {showAssigned && (
                    <td className="text-sm truncate max-w-[10rem] pr-5">
                      {ticket.assignedUsers
                        ?.map((u) => u.firstName)
                        .join(", ") || "Unassigned"}
                    </td>
                  )}
                </tr>
              </a>
            ))}
          {withChecked.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-10 text-gray-500 ">
                No tickets found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TicketTable;
