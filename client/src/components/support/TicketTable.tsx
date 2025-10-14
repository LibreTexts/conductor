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
}

const TicketTable: React.FC<TicketTableProps> = ({
  data,
  showSelect,
  showAssigned,
}) => {
  const { setSelectedTickets } = useSupportCenterContext();
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

  const anyHasCategory = data.some((ticket) => ticket.category);
  const anyHasPriority = data.some((ticket) => ticket.priority);

  return (
    <div className="w-full h-screen overflow-auto border border-gray-200 rounded-lg !bg-white">
      <table className="w-full text-left whitespace-nowrap !bg-white">
        <thead className="sticky top-0 z-10 border-b border-r border-slate-200 text-sm/6  text-gray-900 bg-gray-100 font-semibold shadow-sm">
          <tr className="">
            <th scope="col" className="py-2 pl-5">
              {showSelect ? (
                <Checkbox
                  checked={allSelected}
                  onChange={(checked) => setAllSelected(checked)}
                  name="select-all-tickets"
                  large
                />
              ) : (
                "ID"
              )}
            </th>
            <th scope="col" className={`py-2 lg:w-5/12`}>
              Title
            </th>
            {anyHasCategory && (
              <th scope="col" className="py-2">
                Category
              </th>
            )}
            <th scope="col" className="py-2">
              Requester
            </th>
            {anyHasPriority && (
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
          {withChecked.length > 0 &&
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
                  <td className="pl-5">
                    <div className="flex space-x-3 items-center">
                      {showSelect && (
                        <Checkbox
                          name={`select-ticket-${ticket.uuid}`}
                          large
                          checked={ticket.checked}
                          onChange={(checked) => {
                            updateChecked(ticket.uuid, checked);
                          }}
                        />
                      )}
                      <p className="text-sm font-mono text-gray-500">
                        #{ticket.uuid.slice(-7)}
                      </p>
                    </div>
                  </td>
                  <td className="">
                    <div className="flex flex-col py-3">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 text-lg truncate max-w-lg">
                        {truncateString(ticket.title, 80)}{" "}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(
                          parseISO(ticket.timeOpened),
                          "MM/dd/yyyy hh:mm aa"
                        )}
                      </p>
                    </div>
                  </td>
                  {anyHasCategory && (
                    <td className="text-sm">
                      {getPrettySupportTicketCategory(ticket.category || "")}
                    </td>
                  )}
                  <td className="max-w-[15rem]">
                    <div className="flex items-center space-x-1 text-sm pr-2">
                      <IconUser className="w-4 h-4" />
                      <p className="truncate">{getRequesterText(ticket)}</p>
                    </div>
                  </td>
                  {anyHasPriority && (
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
