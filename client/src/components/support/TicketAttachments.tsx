import { Icon, Label } from "semantic-ui-react";
import { SupportTicket, SupportTicketAttachment } from "../../types";
import { format, parseISO } from "date-fns";
import useGlobalError from "../error/ErrorHooks";
import { useState } from "react";
import LoadingSpinner from "../LoadingSpinner";
import api from "../../api";

interface TicketAttachmentsProps {
  ticket: SupportTicket;
}

const TicketAttachments: React.FC<TicketAttachmentsProps> = ({ ticket }) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);

  async function getDownloadURL(id: string) {
    try {
      setLoading(true);
      const res = await api.getTicketAttachmentURL(ticket.uuid, id);

      if(res.data.err){
        throw new Error(res.data.errMsg);
      }

      if(!res.data.url){
        throw new Error("Unable to get download URL. Please try again later.");
      }

      window.open(res.data.url, "_blank");
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const AttachmentEntry = ({
    attachment,
  }: {
    attachment: SupportTicketAttachment;
  }) => {
    return (
      <div className="flex flex-row items-center mb-2">
        <div className="flex flex-row items-center mb-4">
          <Icon name="file alternate outline" color="blue" />
        </div>
        <div className="ml-1 mb-2">
          <p
            onClick={() => getDownloadURL(attachment.uuid)}
            className="text-blue-500 cursor-pointer"
          >
            {attachment.name}
          </p>
          <p className="text-sm text-gray-500">
            {attachment.uploadedBy} -{" "}
            {format(parseISO(attachment.uploadedDate), "MM/dd/yyyy hh:mm a")}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full bg-white">
      <div className="flex flex-col border shadow-md rounded-md p-4">
        <p className="text-1xl font-semibold text-center mb-0">
          Ticket Attachments
        </p>
        <div className="flex flex-col mt-2">
          {ticket.attachments?.length === 0 && (
            <p className="text-lg text-center text-gray-500 italic">
              No attachments yet...
            </p>
          )}
          {ticket.attachments?.map((a) => (
            <AttachmentEntry attachment={a} key={crypto.randomUUID()} />
          ))}
        </div>
        <div>{loading && <LoadingSpinner />}</div>
      </div>
    </div>
  );
};

export default TicketAttachments;
