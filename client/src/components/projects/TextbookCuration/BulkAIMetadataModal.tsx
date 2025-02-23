import { Button, Checkbox, Icon, Modal } from "semantic-ui-react";
import { useMemo, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import "../Projects.css";
import { useModals } from "../../../context/ModalContext";
import { useNotifications } from "../../../context/NotificationContext";
import api from "../../../api";
import { Project } from "../../../types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface BulkAIMetadataModalProps {
  projectID: string;
  library: string;
  pageID: string;
}

const BulkAIMetadataModal: React.FC<BulkAIMetadataModalProps> = ({
  projectID,
  library,
  pageID,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<boolean>(false);
  const [tags, setTags] = useState<boolean>(false);
  const [summaries, setSummaries] = useState<boolean>(false);
  const [alttext, setAlttext] = useState<boolean>(false);
  const { data: projectData, isLoading: projectLoading } = useQuery<
    Project | undefined
  >({
    queryKey: ["project", projectID],
    queryFn: async () => {
      if (!projectID) return undefined;
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw res.data.errMsg;
      }

      return res.data.project;
    },
    enabled: !!projectID,
  });

  const lastJob = useMemo(() => {
    if (!projectData || !projectData.batchUpdateJobs) {
      return null;
    }

    return projectData.batchUpdateJobs.sort((a, b) => {
      if (!a.startTimestamp || !b.startTimestamp) {
        return 0;
      }
      return (
        new Date(b.startTimestamp).getTime() -
        new Date(a.startTimestamp).getTime()
      );
    })[0];
  }, [projectData]);

  async function handleSubmit() {
    try {
      if (!library || !pageID) {
        throw new Error("Missing library or page ID");
      }

      if (!summaries && !tags && !alttext) {
        throw new Error("Please select a resource to generate.");
      }

      setLoading(true);

      const res = await api.batchGenerateAIMetadata(
        `${library}-${pageID}`,
        summaries,
        tags,
        alttext
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      addNotification({
        type: "success",
        message:
          "We're generating AI metadata for this book. We'll send you an email when we've finished.",
      });

      queryClient.invalidateQueries(["project", projectID]);

      closeAllModals();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal size="large" open={true} onClose={closeAllModals}>
      <Modal.Header>Generate AI Metadata?</Modal.Header>
      <Modal.Content>
        <p className="text-lg mb-2">
          Are you sure you want to generate AI metadata for all pages in this
          book? This will overwrite any existing summaries, tags, and image alt
          text (if selected).
        </p>
        <p className="text-lg mb-2">
          <strong>Note:</strong> Structural pages like the Table of Contents,
          chapter cover pages, etc., will not be processed. This operation may
          take some time, so we'll send you an email when it's complete. Only
          one bulk operation can be run at a time on a book.
        </p>
        <div className="flex flex-col space-y-6 my-12">
          <Checkbox
            label="Generate Summaries"
            checked={summaries}
            onChange={() => setSummaries(!summaries)}
            toggle
          />
          <Checkbox
            label="Generate Tags"
            checked={tags}
            onChange={() => setTags(!tags)}
            toggle
          />
          <Checkbox
            label="Generate Image(s) Alt Text"
            checked={alttext}
            onChange={() => setAlttext(!alttext)}
            toggle
          />
        </div>
        <p className="text-sm text-center text-slate-500 italic px-4 mt-6">
          Caution: AI-generated output may not always be accurate. Please
          thoroughly review content before publishing. LibreTexts is not
          responsible for any inaccuracies in AI-generated content.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex flex-row justify-between items-center">
          <p className="text-sm text-slate-500 italic">
            Last updated:{" "}
            {lastJob?.endTimestamp
              ? new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date(lastJob.endTimestamp))
              : "Never"}
          </p>
          <div>
            <Button onClick={closeAllModals} loading={loading}>
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleSubmit}
              loading={loading}
              disabled={!summaries && !tags && !alttext}
            >
              <Icon name="magic" /> Generate
            </Button>
          </div>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkAIMetadataModal;
