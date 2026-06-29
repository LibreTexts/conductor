import { SupportTicket, SupportTicketFeedEntry } from "../../types";
import { format, parseISO } from "date-fns";
import { Card, Heading, IconButton, Stack, Text } from "@libretexts/davis-react";
import {
  IconActivity,
  IconAlertTriangle,
  IconCircleCheck,
  IconFile,
  IconInbox,
  IconMail,
  IconPlus,
  IconRefresh,
  IconTag,
  IconUserShare,
} from "@tabler/icons-react";

interface TicketFeedProps {
  ticket: SupportTicket;
}

// Pick a decorative icon for a feed entry based on the action text. Purely visual; the
// action label always carries the meaning.
const feedIcon = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes("assigned")) return IconUserShare;
  if (a.includes("closed")) return IconCircleCheck;
  if (a.includes("reopen")) return IconRefresh;
  if (a.includes("priority")) return IconAlertTriangle;
  if (a.includes("category")) return IconTag;
  if (a.includes("queue")) return IconInbox;
  if (a.includes("cc")) return IconMail;
  if (a.includes("created")) return IconPlus;
  if (a.includes("attachment")) return IconFile;
  return IconActivity;
};

const TicketFeed: React.FC<TicketFeedProps> = ({ ticket }) => {
  const getEntryTimestamp = (entry: SupportTicketFeedEntry) =>
    format(parseISO(entry.date), "MM/dd/yyyy hh:mm aa");

  return (
    <Card variant="default">
      <Card.Header>
        <Stack direction="horizontal" gap="md" align="start" justify="between">
          <Heading level={4} align="left" className="!mb-0">
            Activity Feed
          </Heading>
        </Stack>
      </Card.Header>
      <Card.Body className="py-4 max-h-96 overflow-y-auto">
        {!ticket.feed || ticket.feed.length === 0 ? (
          <Text align="center" size="lg">
            No history yet...
          </Text>
        ) : (
          <div className="flex flex-col divide-y divide-gray-200">
            {ticket.feed.map((f, idx) => {
              const Icon = feedIcon(f.action);
              return (
                <div key={idx} className="flex items-start gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                  >
                    <Icon size={14} />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <Text size="base" className="block font-semibold break-words">
                      {f.action}
                    </Text>
                    <Text size="sm" color="muted" className="block">
                      {f.blame} · {getEntryTimestamp(f)}
                    </Text>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
export default TicketFeed;
