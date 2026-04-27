import { Button, Divider, Icon, Label } from "semantic-ui-react";
import { SupportTicket, SupportTicketAttachment } from "../../types";
import { format, parseISO, set } from "date-fns";
import useGlobalError from "../error/ErrorHooks";
import { useState } from "react";
import LoadingSpinner from "../LoadingSpinner";
import api from "../../api";
import FileUploader from "../FileUploader";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { supportTicketAttachmentAllowedTypes } from "../../utils/supportHelpers";

interface TicketAttachmentsProps {
  ticket: SupportTicket;
  guestAccessKey?: string;
}

const TicketAttachments: React.FC<TicketAttachmentsProps> = ({
  ticket,
  guestAccessKey,
}) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [showUpload, setShowUpload] = useState<boolean>(false);

  async function getDownloadURL(id: string) {
    try {
      setLoading(true);
      const res = await api.getTicketAttachmentURL(ticket.uuid, id, guestAccessKey);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.url) {
        throw new Error("Unable to get download URL. Please try again later.");
      }

      window.open(res.data.url, "_blank");
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachmentsUpload(ticketID: string, files: File[]) {
    setLoading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    const urlParams = new URLSearchParams();
    if (guestAccessKey) {
      urlParams.append("accessKey", guestAccessKey);
    }

    try {
      const uploadRes = await axios.post(
        `/support/ticket/${ticketID}/attachments${guestAccessKey ? `?${urlParams}` : ""}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (uploadRes.data.err) {
        throw new Error(uploadRes.data.errMsg);
      }
      queryClient.invalidateQueries(["ticket", ticketID]);
    } catch (e: any) {
      if (e.message === "canceled") return; // Noop if canceled
      handleGlobalError(e);
    } finally {
      setLoading(false);
      setShowUpload(false);
      setFiles([]);
    }
  }

  async function saveFilesToState(files: FileList) {
    setLoading(true);
    setFiles(Array.from(files));
    setLoading(false);
  }

  function handleShowUpload() {
    setShowUpload(!showUpload);
  }

  function handleCloseUpload() {
    setShowUpload(false);
    setFiles([]); // Clear out the files if the user closes the upload section
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
        <div className="flex flex-row items-center">
          <div className="flex basis-5/6 justify-center">
            <p className="text-1xl font-semibold text-center mb-0 ml-56">
              Ticket Attachments
            </p>
          </div>
          <div className="flex basis-1/6 justify-end">
            <Button
              icon={showUpload ? "x" : "plus"}
              color="blue"
              onClick={() => {
                showUpload ? handleCloseUpload() : handleShowUpload();
              }}
            ></Button>
          </div>
        </div>
        {showUpload && (
          <div className="my-2">
            <FileUploader
              fileTypes={supportTicketAttachmentAllowedTypes}
              maxFiles={4}
              maxFileSize={100 * 1024 * 1024} // 100 MB
              onUpload={saveFilesToState}
              allowScreenCast
            />
            {files.length > 0 && (
              <div className="flex flex-row justify-end mt-4">
                <Button
                  color="blue"
                  onClick={() => handleAttachmentsUpload(ticket.uuid, files)}
                  loading={loading}
                >
                  <Icon name="upload" />
                  Upload
                </Button>
              </div>
            )}
            <Divider />
          </div>
        )}
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
