import { Breadcrumb, Button, Checkbox, Tooltip } from "@libretexts/davis-react";
import { IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import useProject from "../../../../hooks/useProject";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import EventFeed from "../../../../components/util/EventFeed";
import api from "../../../../api";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useModals } from "../../../../context/ModalContext";
import { useNotifications } from "../../../../context/NotificationContext";
import ConfirmModal from "../../../../components/ConfirmModal";
import ActiveJobAlert from "../../../../components/projects/TextbookCuration/ActiveJobAlert";
import useProjectBatchUpdateJobs from "../../../../hooks/useProjectBatchUpdateJobs";

const BatchRun = () => {
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();

  const { id: projectID } = useParams<{ id: string }>();
  const { project, bookID } = useProject(projectID);
  const { activeBatchJob, mutations } = useProjectBatchUpdateJobs(projectID);

  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  const [tags, setTags] = useState<boolean>(false);
  const [overwriteTags, setOverwriteTags] = useState<boolean>(false);
  const [summaries, setSummaries] = useState<boolean>(false);
  const [overwriteSummaries, setOverwriteSummaries] = useState<boolean>(false);
  const [alttext, setAlttext] = useState<boolean>(false);
  const [overwriteAlttext, setOverwriteAlttext] = useState<boolean>(false);

  async function runBatchJob() {
    try {
      if (!bookID) {
        setMessages((prev) => [...prev, "Error: Book ID is not available for this project."]);
        return;
      }

      const eventSource = api.batchGenerateAIMetadata(bookID, {
        summaries: { generate: summaries, overwrite: overwriteSummaries },
        tags: { generate: tags, overwrite: overwriteTags },
        alttext: { generate: alttext, overwrite: overwriteAlttext },
      });

      eventSource.onopen = () => {
        setConnected(true);
        mutations.refreshActiveJobStatus.mutate();
        addNotification({
          type: "success",
          message: "Started batch job. This may take a while depending on the size of the book.",
        });
      };

      eventSource.onmessage = (event) => {
        setMessages((prev) => [...prev, event.data]);
        if (event.data.includes("END")) {
          eventSource.close();
          setConnected(false);
          mutations.refreshActiveJobStatus.mutate();
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        eventSource.close();
        setConnected(false);
        mutations.refreshActiveJobStatus.mutate();
      };
    } catch (error) {
      handleGlobalError(error);
    }
  }

  useEffect(() => {
    if (!summaries) setOverwriteSummaries(false);
    if (!tags) setOverwriteTags(false);
    if (!alttext) setOverwriteAlttext(false);
  }, [summaries, tags, alttext]);

  const lastJob = useMemo(() => {
    if (!project?.batchUpdateJobs) return null;
    return project.batchUpdateJobs.sort((a, b) => {
      if (!a.startTimestamp || !b.startTimestamp) return 0;
      return new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime();
    })[0];
  }, [project]);

  async function handleSubmitButton() {
    if (!summaries && !tags && !alttext) return;

    if (overwriteSummaries || overwriteTags || overwriteAlttext) {
      openModal(
        <ConfirmModal
          text="You have selected one or more overwrite options. This will replace any existing metadata and cannot be undone. Are you sure you want to continue?"
          onConfirm={() => { closeAllModals(); runBatchJob(); }}
          onCancel={closeAllModals}
          confirmColor="red"
          confirmText="Yes, Overwrite"
        />
      );
      return;
    }
    runBatchJob();
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        AI Co-Author: <em>{project?.title}</em>
      </h1>

      {/* Breadcrumb + last updated */}
      <div className="flex flex-row justify-between items-center py-2 border-b">
        <Breadcrumb>
          <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
          <Breadcrumb.Item><Link to={`/projects/${projectID}`}>{project?.title || "Loading..."}</Link></Breadcrumb.Item>
          <Breadcrumb.Item><Link to={`/projects/${projectID}/ai-co-author`}>AI Co-Author</Link></Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Batch Run</Breadcrumb.Item>
        </Breadcrumb>
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
      </div>

      {/* Main content */}
      <p className="text-lg">
        Changes to each page will be saved automatically as the job progresses. You can revise the
        generated metadata later if needed. Only one bulk operation can be run at a time on a book.
      </p>
      <p className="text-lg">
        Alt text generation is currently supported for the following image types: JPEG, PNG, GIF,
        WEBP, BMP, SVG. Alt text consisting of only the filename will be considered empty and always
        overwritten.
      </p>

      {activeBatchJob ? (
        <ActiveJobAlert
          job={activeBatchJob}
          onRefresh={() => { mutations.refreshActiveJobStatus.mutate(); window.location.reload(); }}
          loading={mutations.refreshActiveJobStatus.isLoading}
        />
      ) : (
        <table className="w-full border border-gray-200 rounded text-sm mt-2">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold w-1/2">Resource Type</th>
              <th className="text-left px-4 py-3 font-semibold">Overwrite?</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="px-4 py-3">
                <Checkbox
                  name="generateSummaries"
                  label="Generate Summaries"
                  checked={summaries}
                  onChange={(checked) => setSummaries(checked)}
                />
              </td>
              <td className={`px-4 py-3 flex items-center gap-2 ${!summaries ? "opacity-50" : ""}`}>
                <Checkbox
                  name="overwriteSummaries"
                  label="Overwrite Existing Summaries"
                  checked={overwriteSummaries}
                  onChange={(checked) => setOverwriteSummaries(checked)}
                  disabled={!summaries}
                />
                <Tooltip content="All existing summaries will be replaced with AI-generated summaries.">
                  <span><IconInfoCircle size={16} className="text-gray-500 cursor-help" /></span>
                </Tooltip>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-4 py-3">
                <Checkbox
                  name="generateTags"
                  label="Generate Tags"
                  checked={tags}
                  onChange={(checked) => setTags(checked)}
                />
              </td>
              <td className={`px-4 py-3 flex items-center gap-2 ${!tags ? "opacity-50" : ""}`}>
                <Checkbox
                  name="overwriteTags"
                  label="Overwrite Existing Tags"
                  checked={overwriteTags}
                  onChange={(checked) => setOverwriteTags(checked)}
                  disabled={!tags}
                />
                <Tooltip content="If selected, user-defined tags will be overwritten. If not selected, only pages without user-defined tags will have tags generated. Tags for system functions (e.g. 'license', 'licenseversion') are never overwritten.">
                  <span><IconInfoCircle size={16} className="text-gray-500 cursor-help" /></span>
                </Tooltip>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-4 py-3">
                <Checkbox
                  name="generateAltText"
                  label="Generate Image(s) Alt Text"
                  checked={alttext}
                  onChange={(checked) => setAlttext(checked)}
                />
              </td>
              <td className={`px-4 py-3 flex items-center gap-2 ${!alttext ? "opacity-50" : ""}`}>
                <Checkbox
                  name="overwriteAltText"
                  label="Overwrite Existing Alt Text"
                  checked={overwriteAlttext}
                  onChange={(checked) => setOverwriteAlttext(checked)}
                  disabled={!alttext}
                />
                <Tooltip content="If selected, existing alt text will be replaced with AI-generated alt text. If not selected, only images without alt text will have alt text generated. Alt text consisting of only the filename will be considered empty and always overwritten.">
                  <span><IconInfoCircle size={16} className="text-gray-500 cursor-help" /></span>
                </Tooltip>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="px-4 py-3 border-t border-gray-200">
                <div className="flex flex-row items-center justify-between">
                  <p className="text-sm text-slate-800 italic">
                    Caution: AI-generated output may not always be accurate. Please thoroughly review
                    content before publishing. LibreTexts is not responsible for any inaccuracies in
                    AI-generated content.
                  </p>
                  <Button
                    variant="primary"
                    icon={<IconSparkles size={14} />}
                    onClick={handleSubmitButton}
                    disabled={!summaries && !tags && !alttext}
                  >
                    Generate
                  </Button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <hr className="my-2" />
      <EventFeed messages={messages} connected={connected} autoScroll showTimestamp className="mt-2" />
    </div>
  );
};

export default BatchRun;
