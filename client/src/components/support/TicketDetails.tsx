import { Button } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";

interface TicketDetailsProps {
  ticket: SupportTicket;
}

const TicketDetails: React.FC<TicketDetailsProps> = ({ ticket }) => {
  const centralIdentityURL = (centralID: string) => {
    return `/controlpanel/libreone/users?user_id=${centralID}`;
  };

  return (
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white">
      <p className="2xl:text-xl">
        <span className="font-semibold">Subject:</span> {ticket?.title}
      </p>
      <div className="flex flex-row items-center">
        <p className="2xl:text-xl font-semibold">Requester:</p>{" "}
        {ticket.user && (
          <>
            <a
              href={centralIdentityURL(ticket.user.centralID ?? "")}
              target="_blank"
              className="2xl:text-xl ml-1"
            >
              {`${ticket.user.firstName} ${ticket.user.lastName} (${ticket.user.email})`}
            </a>
            <Button
              className="!ml-2 !p-2"
              basic
              color="green"
              size="mini"
              onClick={() => {
                if (!ticket.user?.centralID) return;
                window.open(
                  centralIdentityURL(ticket.user.centralID),
                  "_blank"
                );
              }}
            >
              Authenticated
            </Button>
          </>
        )}
        {ticket.guest &&
          `${ticket.guest.firstName} ${ticket.guest.lastName} (${ticket.guest.email})`}
      </div>
      <p className="2xl:text-xl">
        <span className="font-semibold">Category:</span>{" "}
        {getPrettySupportTicketCategory(ticket?.category)}
      </p>
      <p className="2xl:text-xl">
        <span className="font-semibold">Priority:</span>{" "}
        {capitalizeFirstLetter(ticket?.priority) ?? "Unknown"}
      </p>
      <p className="2xl:text-xl break-all">
        <span className="font-semibold">Captured URL:</span>
        {ticket?.capturedURL ? (
          <a
            href={ticket.capturedURL}
            target="_blank"
            rel="noreferrer"
            className="ml-2"
          >
            {ticket.capturedURL}
          </a>
        ) : (
          <span className="ml-2">N/A</span>
        )}
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
    </div>
  );
};

export default TicketDetails;
