import { SupportTicket, SupportTicketFeedEntry } from "../../types";
import { format, parseISO } from "date-fns";
import { Card, Heading, Stack, Text, Timeline } from "@libretexts/davis-react";

interface TicketFeedProps {
  ticket: SupportTicket;
}

const TicketFeed: React.FC<TicketFeedProps> = ({ ticket }) => {
  const getEntryTimestamp = (entry: SupportTicketFeedEntry) => {
    return format(parseISO(entry.date), "MM/dd/yyyy hh:mm aa");
  }

  return (
    <Card variant="elevated">
      <Card.Header>
        <Heading level={4} align="center">
          Activity Feed
        </Heading>
      </Card.Header>
      <Card.Body className="py-4 max-h-96 overflow-y-auto">
        <Stack >
          {ticket.feed?.length === 0 && (
            <Text align="center" size="lg">
              No history yet...
            </Text>
          )}
          <Timeline>
            {ticket.feed?.map((f, idx) => (
              <Timeline.Item
                key={idx}
                title={f.action}
                description={f.blame}
                timestamp={getEntryTimestamp(f)}
              />
            ))}
          </Timeline>
        </Stack>
      </Card.Body>
    </Card>
  );
};
export default TicketFeed;
