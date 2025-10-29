import {
  Breadcrumb,
  Button,
  Checkbox,
  Grid,
  Header,
  Icon,
  Segment,
  Table,
} from "semantic-ui-react";
import useProject from "../../../../hooks/useProject";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import EventFeed from "../../../../components/util/EventFeed";
import api from "../../../../api";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useModals } from "../../../../context/ModalContext";
import { useNotifications } from "../../../../context/NotificationContext";
import ConfirmModal from "../../../../components/ConfirmModal";
import Tooltip from "../../../../components/util/Tooltip";
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
        setMessages((prev) => [
          ...prev,
          "Error: Book ID is not available for this project.",
        ]);
        return;
      }

      const eventSource = api.batchGenerateAIMetadata(bookID, {
        summaries: {
          generate: summaries,
          overwrite: overwriteSummaries,
        },
        tags: {
          generate: tags,
          overwrite: overwriteTags,
        },
        alttext: {
          generate: alttext,
          overwrite: overwriteAlttext,
        },
      });

      eventSource.onopen = () => {
        setConnected(true);
        mutations.refreshActiveJobStatus.mutate();
        addNotification({
          type: "success",
          message:
            "Started batch job. This may take a while depending on the size of the book.",
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
    if (!project || !project.batchUpdateJobs) {
      return null;
    }

    return project.batchUpdateJobs.sort((a, b) => {
      if (!a.startTimestamp || !b.startTimestamp) {
        return 0;
      }
      return (
        new Date(b.startTimestamp).getTime() -
        new Date(a.startTimestamp).getTime()
      );
    })[0];
  }, [project]);

  async function handleSubmitButton() {
    if (!summaries && !tags && !alttext) {
      return;
    }

    if (overwriteSummaries || overwriteTags || overwriteAlttext) {
      openModal(
        <ConfirmModal
          text="You have selected one or more overwrite options. This will replace any existing metadata and cannot be undone. Are you sure you want to continue?"
          onConfirm={() => {
            closeAllModals();
            runBatchJob();
          }}
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
    <Grid className="component-container">
      <Grid.Column>
        <Header as="h2" dividing className="component-header">
          AI Co-Author: <span className="italic">{project?.title}</span>
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          <Segment className="flex flex-row justify-between items-center">
            <Breadcrumb>
              <Breadcrumb.Section as={Link} to="/projects">
                Projects
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section as={Link} to={`/projects/${projectID}`}>
                {project?.title || "Loading..."}
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section
                as={Link}
                to={`/projects/${projectID}/ai-co-author`}
              >
                AI Co-Author
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section active>Batch Run</Breadcrumb.Section>
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
          </Segment>
          <Segment>
            <p className="text-lg mb-4">
              Changes to each page will be saved automatically as the job
              progresses. You can revise the generated metadata later if needed.
              Only one bulk operation can be run at a time on a book.
            </p>
            <p className="text-lg mb-4">
              Alt text generation is currently supported for the following image
              types: JPEG, PNG, GIF, WEBP, BMP, SVG. Alt text consisting of only
              the filename will be considered empty and always overwritten.
            </p>
            {activeBatchJob ? (
              <ActiveJobAlert
                job={activeBatchJob}
                onRefresh={() => {
                  mutations.refreshActiveJobStatus.mutate();
                  window.location.reload();
                }}
                loading={mutations.refreshActiveJobStatus.isLoading}
              />
            ) : (
              <Table celled striped className="mt-6" compact>
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
                    <Table.Cell
                      className={`${
                        summaries ? "" : "opacity-50"
                      } flex items-center`}
                    >
                      <Checkbox
                        label="Overwrite Existing Summaries"
                        checked={overwriteSummaries}
                        onChange={() =>
                          setOverwriteSummaries(!overwriteSummaries)
                        }
                        toggle
                        disabled={!summaries}
                      />
                      <Tooltip
                        text="All existing summaries will be replaced with AI-generated summaries."
                        children={
                          <Icon
                            name="question circle"
                            className="!ml-1 !mb-1"
                          />
                        }
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
                    <Table.Cell
                      className={`${
                        tags ? "" : "opacity-50"
                      } flex items-center`}
                    >
                      <Checkbox
                        label="Overwrite Existing Tags"
                        checked={overwriteTags}
                        onChange={() => setOverwriteTags(!overwriteTags)}
                        toggle
                        disabled={!tags}
                      />
                      <Tooltip
                        text="If selected, user-defined tags will be overwritten. If not selected, only pages without user-defined tags will have tags generated.
                              Tags for system functions (e.g. 'license', 'licenseversion') are never overwritten."
                        children={
                          <Icon
                            name="question circle"
                            className="!ml-1 !mb-1"
                          />
                        }
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
                    <Table.Cell
                      className={`${
                        alttext ? "" : "opacity-50"
                      } flex items-center`}
                    >
                      <Checkbox
                        label="Overwrite Existing Alt Text"
                        checked={overwriteAlttext}
                        onChange={() => setOverwriteAlttext(!overwriteAlttext)}
                        toggle
                        disabled={!alttext}
                      />
                      <Tooltip
                        text="If selected, existing alt text will be replaced with AI-generated alt text. If not selected, only images without alt text will have alt text generated. Alt text consisting of only the filename will be considered empty and always overwritten."
                        children={
                          <Icon
                            name="question circle"
                            className="!ml-1 !mb-1"
                          />
                        }
                        disabled={!alttext}
                      />
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
                <Table.Footer>
                  <Table.Row>
                    <Table.HeaderCell colSpan={2} className="">
                      <div className="flex flex-row items-center justify-between">
                        <p className="text-sm !text-center text-slate-800 italic">
                          Caution: AI-generated output may not always be
                          accurate. Please thoroughly review content before
                          publishing. LibreTexts is not responsible for any
                          inaccuracies in AI-generated content.
                        </p>
                        <Button
                          color="green"
                          onClick={handleSubmitButton}
                          disabled={!summaries && !tags && !alttext}
                        >
                          <Icon name="magic" /> Generate
                        </Button>
                      </div>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Footer>
              </Table>
            )}
            <hr className="my-6" />
            <EventFeed
              messages={messages}
              connected={connected}
              autoScroll
              showTimestamp
              className="mt-6"
            />
          </Segment>
        </Segment.Group>
      </Grid.Column>
    </Grid>
  );
};

export default BatchRun;
