import { SupportTicket } from "../../types";
import FileUploader from "../FileUploader";
import { supportTicketAttachmentAllowedTypes } from "../../utils/supportHelpers";
import React, { useState } from "react";
import { Icon, Button } from "semantic-ui-react";
import { useFormContext } from "react-hook-form";
import { useTypedSelector } from "../../state/hooks";
import axios from "axios";
import useGlobalError from "../error/ErrorHooks";
import TechnicalSupportForm from "./RequestForms/TechnicalSupportForm";
import HarvestRequestForm from "./RequestForms/HarvestRequestForm";
import PublishingRequestForm from "./RequestForms/PublishingRequestForm";
import useSupportQueues from "../../hooks/useSupportQueues";
import { useNotifications } from "../../context/NotificationContext";
import { useSupportCenterContext } from "../../context/SupportCenterContext";

interface RenderTicketRequestFormProps {
  queue: string;
  autoCapturedURL?: boolean;
  onSubmitSuccess: () => void;
}

const RenderTicketRequestForm: React.FC<RenderTicketRequestFormProps> = ({
  queue,
  autoCapturedURL,
  onSubmitSuccess,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { selectedQueue } = useSupportCenterContext();
  const { addNotification } = useNotifications();
  const { trigger, getValues, formState } = useFormContext<SupportTicket>();
  const user = useTypedSelector((state) => state.user);
  const { invalidate: invalidateSupportQueues } = useSupportQueues({
    withCount: false,
  });

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  async function handleSubmit() {
    try {
      setLoading(true);
      const formValid = await trigger();
      if (!formValid) {
        return;
      }

      const vals = getValues();
      if (user && user.isAuthenticated) {
        vals.guest = undefined;
      }

      if (selectedQueue === "publishing") {
        if (
          !vals.metadata?.prePublishingChecks?.thumbnails ||
          !vals.metadata?.prePublishingChecks?.spellingGrammar ||
          !vals.metadata?.prePublishingChecks?.summaries ||
          !vals.metadata?.prePublishingChecks?.accessibility
        ) {
          addNotification({
            type: "error",
            message: "All pre-publishing checks must be confirmed.",
          });
          return;
        }
      }

      if (
        (selectedQueue === "publishing" && !vals.metadata?.authors) ||
        !Array.isArray(vals.metadata?.authors) ||
        vals.metadata?.authors.length === 0
      ) {
        addNotification({
          type: "error",
          message: "At least one author is required for publishing requests.",
        });
        return;
      }

      vals.deviceInfo = getDeviceInfo();

      const { apps, ...restVals } = vals;
      const res = await axios.post("/support/ticket", {
        ...restVals,
        apps: apps && Array.isArray(apps) ? apps.filter((app) => app) : [apps],
      });

      if (res.data.err) {
        throw new Error(res.data.err);
      }

      if (!res.data.ticket) {
        throw new Error("Invalid response from server");
      }

      invalidateSupportQueues();

      if (!files || files.length === 0) {
        onSubmitSuccess();
        return;
      }

      await handleAttachmentsUpload(
        res.data.ticket.uuid,
        files,
        res.data.ticket.guestAccessKey
      );
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachmentsUpload(
    ticketID: string,
    files: File[],
    guestAccessKey?: string
  ) {
    setLoading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const uploadRes = await axios.post(
        `/support/ticket/${ticketID}/attachments${
          guestAccessKey ? `?accessKey=${guestAccessKey}` : ""
        }`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (uploadRes.data.err) {
        throw new Error(uploadRes.data.errMsg);
      }
      onSubmitSuccess();
    } catch (e: any) {
      if (e.message === "canceled") return; // Noop if canceled
      setLoading(false);
      handleGlobalError(e);
    }
  }

  function getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  async function saveFilesToState(filesToSet: FileList) {
    setLoading(true);
    setFiles([...Array.from(filesToSet)]);
    setLoading(false);
  }

  const RenderedForm = () => {
    switch (queue) {
      case "harvesting":
        return <HarvestRequestForm />;
      case "publishing":
        return <PublishingRequestForm />;
      case "support":
      default:
        return <TechnicalSupportForm autoCapturedURL={autoCapturedURL} />;
    }
  };

  return (
    <div className="p-2">
      <RenderedForm />
      <div className="mt-6">
        <label className="text-gray-700 font-semibold">
          Attachments (optional) (max 4 files, 100 MB each)
        </label>
        <FileUploader
          fileTypes={supportTicketAttachmentAllowedTypes}
          maxFiles={4}
          maxFileSize={100 * 1024 * 1024} // 100 MB
          onUpload={saveFilesToState}
          className="mt-1"
          allowScreenCast
        />
      </div>
      <div className="flex flex-row justify-end mt-4">
        <Button color="blue" loading={loading} onClick={handleSubmit}>
          <Icon name="paper plane" />
          Submit
        </Button>
      </div>
    </div>
  );
};
export default RenderTicketRequestForm;
