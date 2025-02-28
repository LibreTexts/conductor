import { Button, Checkbox, Icon, Modal, Table } from "semantic-ui-react";
import { useEffect, useMemo, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import "../Projects.css";
import { useModals } from "../../../context/ModalContext";
import { useNotifications } from "../../../context/NotificationContext";
import api from "../../../api";
import { Project } from "../../../types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../../ConfirmModal";

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
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<boolean>(false);

  const [tags, setTags] = useState<boolean>(false);
  const [overwriteTags, setOverwriteTags] = useState<boolean>(false);
  const [summaries, setSummaries] = useState<boolean>(false);
  const [overwriteSummaries, setOverwriteSummaries] = useState<boolean>(false);
  const [alttext, setAlttext] = useState<boolean>(false);
  const [overwriteAlttext, setOverwriteAlttext] = useState<boolean>(false);

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

  // Reset overwrite checkboxes if the corresponding resource is not selected
  useEffect(() => {
    if (!summaries) {
      setOverwriteSummaries(false);
    }
    if (!tags) {
      setOverwriteTags(false);
    }
    if (!alttext) {
      setOverwriteAlttext(false);
    }
  }, [summaries, tags, alttext]);

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

  async function handleSubmitButton() {
    if (!summaries && !tags && !alttext) {
      return;
    }

    if (overwriteSummaries || overwriteTags || overwriteAlttext) {
      openModal(
        <ConfirmModal
          text="You have selected one or more overwrite options. This will replace any existing metadata and cannot be undone. Are you sure you want to continue?"
          onConfirm={submitJob}
          onCancel={closeAllModals}
          confirmColor="red"
          confirmText="Yes, Overwrite"
        />
      );
      return;
    }
    submitJob();
  }

  async function submitJob() {
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
        { generate: summaries, overwrite: overwriteSummaries },
        { generate: tags, overwrite: overwriteTags },
        { generate: alttext, overwrite: overwriteAlttext }
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
          book? This operation may take some time, so we'll send you an email
          when it's complete. Only one bulk operation can be run at a time on a
          book.
        </p>
        <p>
          Alt text generation is currently supported for the following image types: JPEG, PNG, GIF, WEBP, BMP, 
        </p>
        <Table celled striped className="mt-6">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Resource Type</Table.HeaderCell>
              <Table.HeaderCell>Overwrite?</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
                <Checkbox
                  label="Generate Summaries"
                  checked={summaries}
                  onChange={() => setSummaries(!summaries)}
                  toggle
                />
              </Table.Cell>
              <Table.Cell className={summaries ? "" : "opacity-50"}>
                <Checkbox
                  label="Overwrite Existing Summaries"
                  checked={overwriteSummaries}
                  onChange={() => setOverwriteSummaries(!overwriteSummaries)}
                  toggle
                  disabled={!summaries}
                />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <Checkbox
                  label="Generate Tags"
                  checked={tags}
                  onChange={() => setTags(!tags)}
                  toggle
                />
              </Table.Cell>
              <Table.Cell className={tags ? "" : "opacity-50"}>
                <Checkbox
                  label="Overwrite Existing Tags"
                  checked={overwriteTags}
                  onChange={() => setOverwriteTags(!overwriteTags)}
                  toggle
                  disabled={!tags}
                />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                <Checkbox
                  label="Generate Image(s) Alt Text"
                  checked={alttext}
                  onChange={() => setAlttext(!alttext)}
                  toggle
                />
              </Table.Cell>
              <Table.Cell className={alttext ? "" : "opacity-50"}>
                <Checkbox
                  label="Overwrite Existing Alt Text"
                  checked={overwriteAlttext}
                  onChange={() => setOverwriteAlttext(!overwriteAlttext)}
                  toggle
                  disabled={!alttext}
                />
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        <p className="text-sm text-center text-slate-600 italic px-4 mt-6">
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
              onClick={handleSubmitButton}
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
