import { Label } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";

interface TicketDetailsProps {
  ticket: SupportTicket;
}

const TicketDetails: React.FC<TicketDetailsProps> = ({ ticket }) => {
  return (
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white">
      <p className="2xl:text-xl">
        <span className="font-semibold">Requester:</span>{" "}
        {ticket.user && (
          <>
            <span>
              `${ticket.user.firstName} ${ticket.user.lastName} ($
              {ticket.user.email})`
            </span>
            <Label>Authenticated</Label>
          </>
        )}
        {ticket.guest &&
          `${ticket.guest.firstName} ${ticket.guest.lastName} (${ticket.guest.email})`}
      </p>
      <p className="2xl:text-xl">
        <span className="font-semibold">Subject:</span> {ticket?.title}
      </p>
      <p className="2xl:text-xl">
        <span className="font-semibold">Date Opened:</span>{" "}
        {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
      </p>
      {ticket.status === "closed" && (
        <p className="2xl:text-xl">
          <span className="font-semibold">Date Closed:</span>{" "}
          {format(parseISO(ticket.timeClosed ?? ""), "MM/dd/yyyy hh:mm aa")}
        </p>
      )}
      <p className="2xl:text-xl">
        <span className="font-semibold">Description:</span>{" "}
        {ticket?.description}
      </p>
    </div>
  );
};

export default TicketDetails;
