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
import { Button, Card, Divider, Heading, IconButton, Stack, Text } from "@libretexts/davis-react";
import { IconFile, IconPlus, IconUpload, IconX } from "@tabler/icons-react";

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
          <IconFile size={24} className="text-gray-500 mr-2" />
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
    <Card variant="elevated">
      <Card.Header>
        <Stack direction="horizontal" gap="md" align="start" justify="center">
          <Heading level={4} align="center">
            Attachments
          </Heading>
          <IconButton
            aria-label={showUpload ? "Close attachment uploader" : "Add attachments"}
            icon={showUpload ? <IconX size={16} /> : <IconPlus size={16} />}
            variant="primary"
            onClick={() => {
              showUpload ? handleCloseUpload() : handleShowUpload();
            }}
          />
        </Stack>
      </Card.Header>
      <Card.Body className="py-2">
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
                  variant="primary"
                  onClick={() => handleAttachmentsUpload(ticket.uuid, files)}
                  loading={loading}
                  icon={<IconUpload size={16} />}
                >
                  Upload
                </Button>
              </div>
            )}
            <Divider />
          </div>
        )}
        <Stack className="mt-2">
          {ticket.attachments?.length === 0 && (
            <Text size="base" align="center">
              No attachments yet...
            </Text>
          )}
          {ticket.attachments?.map((a) => (
            <AttachmentEntry attachment={a} key={crypto.randomUUID()} />
          ))}
        </Stack>
        <div>{loading && <LoadingSpinner />}</div>
      </Card.Body>
    </Card>
  );
};

export default TicketAttachments;
