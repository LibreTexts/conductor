import { Button, Icon } from "semantic-ui-react";
import { useTypedSelector } from "../../state/hooks";
import { SupportTicket } from "../../types";
import { camelCaseToSpaces } from "../../utils/misc";

interface TicketMetadataProps {
  ticket: SupportTicket;
}

const TicketMetadata: React.FC<TicketMetadataProps> = ({ ticket }) => {
  const user = useTypedSelector((state) => state.user);
  const projectID = ticket?.metadata?.projectID as string | undefined;

  const RenderObject = ({ obj }: { obj: Record<string, any> }) => {
    return (
      <div className="flex flex-col space-y-1">
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} className="flex flex-row">
            <span className="font-semibold">{camelCaseToSpaces(key)}:</span>
            &nbsp;
            <span>{String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!ticket.metadata || Object.keys(ticket.metadata).length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white h-fit space-y-1.5">
      <div className="relative flex items-center justify-center mb-2">
        <p className="text-2xl font-semibold text-center mb-0">
          Ticket Metadata
        </p>
        {/* Push button to the right of heading, but keep heading centered */}
        <Button className="absolute right-0" color="green">
          <Icon name="plus" />
          Create Project
        </Button>
      </div>
      <RenderObject obj={ticket.metadata} />
    </div>
  );
};

export default TicketMetadata;
