import { Button, Icon, Label } from "semantic-ui-react";
import { SupportTicket } from "../../types";
import { format, parseISO } from "date-fns";
import { getPrettySupportTicketCategory } from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { useModals } from "../../context/ModalContext";
import AddCCModal from "./AddCCModal";

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
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white h-fit space-y-1.5">
      <p className="text-2xl font-semibold text-center mb-0">Ticket Details</p>
      <p className="2xl:text-xl break-all">
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
        {ticket.guest && (
          <div className="flex flex-row justify-center ml-1 text-xl">
            {ticket.guest.firstName} {ticket.guest.lastName} (
            {ticket.guest.email})
            <Label
              className="!ml-2 !p-2 !cursor-default"
              basic
              color="yellow"
              size="mini"
            >
              Guest
            </Label>
          </div>
        )}
      </div>
      <div className="flex flex-row items-center">
        <p className="2xl:text-xl">
          <span className="font-semibold">CC'd:</span>{" "}
          {ticket?.ccedEmails?.map((c) => c.email).join(", ") || "None"}
        </p>
        {ticket.status !== "closed" && (
          <Button
            className="!ml-2 !p-2 !min-w-20"
            basic
            color="blue"
            size="mini"
            onClick={() => openAddCCModal()}
          >
            <Icon name="plus" />
            Add CC
          </Button>
        )}
      </div>
      {
        ticket?.category && (
          <p className="2xl:text-xl">
            <span className="font-semibold">Category:</span>{" "}
            {getPrettySupportTicketCategory(ticket?.category)}
          </p>
        )}
      {
        ticket?.priority && (
          <p className="2xl:text-xl">
            <span className="font-semibold">Priority:</span>{" "}
            {capitalizeFirstLetter(ticket?.priority) ?? "Unknown"}
          </p>
        )}
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
      <div className="flex flex-col">
        <p className="2xl:text-xl">
          <span className="font-semibold">Device Info:</span>{" "}
          {ticket.deviceInfo && Object.keys(ticket.deviceInfo).length !== 0
            ? ""
            : "Not Available"}
        </p>
        {ticket.deviceInfo && (
          <div className="mt-0.5 ml-1.5">
            <p className="text-sm">
              <span className="font-semibold">User Agent:</span>{" "}
              {ticket.deviceInfo?.userAgent || "Unknown"}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Language:</span>{" "}
              {ticket.deviceInfo?.language || "Unknown"}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Screen Resolution:</span>{" "}
              {ticket.deviceInfo?.screenResolution || "Unknown"}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Time Zone:</span>{" "}
              {ticket.deviceInfo?.timeZone || "Unknown"}
            </p>
          </div>
        )}
      </div>
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
