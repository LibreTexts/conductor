import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { useModals } from "../../context/ModalContext";
import AddCCModal from "./AddCCModal";
import { Badge, Button, Card, Heading, Link, Stack, Text } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";

interface TicketDetailsProps {
  ticket: SupportTicket;
}

const TicketDetails: React.FC<TicketDetailsProps> = ({ ticket }) => {
  const { openModal, closeAllModals } = useModals();

  const centralIdentityURL = (centralID: string) => {
    return `/controlpanel/libreone/users/${centralID}`;
  };

  const openAddCCModal = () => {
    openModal(
      <AddCCModal ticketId={ticket.uuid} onClose={closeAllModals} open />
    );
  };

  return (
    <Card padding="sm" variant="elevated">
      <Card.Header>
        <Heading level={4} align="center">
          Ticket Details
        </Heading>
      </Card.Header>
      <Card.Body className="py-4">
        <Stack gap="xs">
          <Text size="lg" className="break-all">
            <span className="font-semibold">Subject:</span> {ticket?.title}
          </Text>
          <Stack direction="horizontal" gap="xs" align="start">
            <Text size="lg" className="font-semibold">Requester:</Text>{" "}
            {ticket.user && (
              <Link
                href={ticket.user?.centralID ? centralIdentityURL(ticket.user.centralID) : "#"}
                target="_blank"
                rel="noreferrer"
              >
                {`${ticket.user.firstName} ${ticket.user.lastName} (${ticket.user.email})`}  (Authenticated)
              </Link>
            )}
            {ticket.guest && (
              <Stack direction="horizontal" gap="xs" align="center">
                <Text size="lg">
                  {ticket.guest.firstName} {ticket.guest.lastName} (
                  {ticket.guest.email})
                </Text>
                <Badge
                  variant="warning"
                  label="Guest"
                />
              </Stack>
            )}
          </Stack>
          <Stack direction="horizontal" gap="md" align="center">
            <Text size="lg" className="break-all">
              <span className="font-semibold">CC'd:</span>{" "}
              {ticket?.ccedEmails?.map((c) => c.email).join(", ") || "None"}
            </Text>
            {ticket.status !== "closed" && (
              <Button
                onClick={() => openAddCCModal()}
                variant="outline"
                icon={<IconPlus size={12} />}
              >
                Add CC
              </Button>
            )}
          </Stack>
          {
            ticket?.category && (
              <Text size="lg" className="break-all">
                <span className="font-semibold">Category:</span>{" "}
                {getPrettySupportTicketCategory(ticket?.category)}
              </Text>
            )}
          {
            ticket?.priority && (
              <Text size="lg" className="break-all">
                <span className="font-semibold">Priority:</span>{" "}
                {capitalizeFirstLetter(ticket?.priority) ?? "Unknown"}
              </Text>
            )}
          <Text size="lg" className="break-all">
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
          </Text>
          <Text size="lg" className="break-all">
            <span className="font-semibold">Date Opened:</span>{" "}
            {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
          </Text>
          {ticket.status === "closed" && (
            <Text size="lg" className="break-all">
              <span className="font-semibold">Date Closed:</span>{" "}
              {format(parseISO(ticket.timeClosed ?? ""), "MM/dd/yyyy hh:mm aa")}
            </Text>
          )}
          <div className="flex flex-col">
            <Text size="lg" className="break-all">
              <span className="font-semibold">Device Info:</span>{" "}
              {ticket.deviceInfo && Object.keys(ticket.deviceInfo).length !== 0
                ? ""
                : "Not Available"}
            </Text>
            {ticket.deviceInfo && (
              <div>
                <Text size="xs" className="break-all">
                  <span className="font-semibold">User Agent:</span>{" "}
                  {ticket.deviceInfo?.userAgent || "Unknown"};{" "}
                </Text>
                <Text size="xs" className="break-all">
                  <span className="font-semibold">Language:</span>{" "}
                  {ticket.deviceInfo?.language || "Unknown"};{" "}
                </Text>
                <Text size="xs" className="break-all">
                  <span className="font-semibold">Screen Resolution:</span>{" "}
                  {ticket.deviceInfo?.screenResolution || "Unknown"};{" "}
                </Text>
                <Text size="xs" className="break-all">
                  <span className="font-semibold">Time Zone:</span>{" "}
                  {ticket.deviceInfo?.timeZone || "Unknown"};{" "}
                </Text>
              </div>
            )}
          </div>
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default TicketDetails;
