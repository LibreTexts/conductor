import { Button, Icon } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format as formatDate } from "date-fns";

interface TicketAutoCloseWarningProps {
  ticket: SupportTicket;
  onDisableAutoClose: () => void;
}

const TicketAutoCloseWarning: React.FC<TicketAutoCloseWarningProps> = ({
  ticket,
  onDisableAutoClose,
}) => {
  return (
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white mb-4">
      <div className="flex flex-row items-center mb-2">
        <Icon name="warning sign" color="yellow" size="big" />
        <p className="text-lg ml-2">
          <strong>Notice: </strong>
          Ticket will be automatically closed on{" "}
          {formatDate(
            new Date(ticket.autoCloseDate?.toString() ?? ""),
            "MM/dd/yyyy hh:mm aa"
          )}{" "}
          if no new comments are added.
        </p>
      </div>
      <Button color="blue" onClick={onDisableAutoClose}>
        Disable Auto Close
      </Button>
    </div>
  );
};

export default TicketAutoCloseWarning;
