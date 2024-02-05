import { Label } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";

interface TicketAttachmentsProps {
  ticket: SupportTicket;
}

const TicketAttachments: React.FC<TicketAttachmentsProps> = ({ ticket }) => {
  return (
    <div className="flex flex-col w-full bg-white">
    <div className="flex flex-col border shadow-md rounded-md p-4">
      <p className="text-1xl font-semibold text-center mb-0">Ticket Attachments</p>
      <div className="flex flex-col mt-2">
        {ticket.feed?.length === 0 && (
          <p className="text-lg text-center text-gray-500 italic">
            No history yet...
          </p>
        )}
      </div>
    </div>
  </div>
  );
};

export default TicketAttachments;
