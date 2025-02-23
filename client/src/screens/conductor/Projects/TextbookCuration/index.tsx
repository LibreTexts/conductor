import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Label,
  Segment,
  Accordion,
  Message,
  Placeholder,
  PlaceholderLine,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  ButtonGroup,
} from "semantic-ui-react";
import { useModals } from "../../../../context/ModalContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import {
  Prettify,
  Project,
  ProjectBookBatchUpdateJob,
  TableOfContentsDetailed,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useNotifications } from "../../../../context/NotificationContext";
import "../../../../components/projects/Projects.css";
import { DISABLED_PAGE_TAG_PREFIXES } from "../../../../utils/misc";
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom-v5-compat";
import ConfirmModal from "../../../../components/ConfirmModal";
import { useFieldArray, useForm } from "react-hook-form";
import CtlTextArea from "../../../../components/ControlledInputs/CtlTextArea";
import BulkAIMetadataModal from "../../../../components/projects/TextbookCuration/BulkAIMetadataModal";
import BulkAddTagModal from "../../../../components/projects/TextbookCuration/BulkAddTagModal";
import SingleAddTagModal from "../../../../components/projects/TextbookCuration/SingleAddTagModal";
import ViewBulkUpdateHistoryModal from "../../../../components/projects/TextbookCuration/ViewBulkUpdateHistoryModal";

type WithUIState = Prettify<
  Omit<TableOfContentsDetailed, "children"> & {
    expanded: boolean;
    isRoot: boolean;
    children: WithUIState[];
  }
>;

type FormWorkingData = {
  pages: {
    pageID: string;
    overview: string;
    tags: string[];
  }[];
};

const TextbookCuration = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const { openModal } = useModals();
  const [hasMadeChanges, setHasMadeChanges] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState<boolean>(false);

  const { control, setValue } = useForm<FormWorkingData>();
  const { fields, append, update, replace } = useFieldArray({
    control,
    name: "pages", // unique name for your Field Array
  });

  const { data: projectData } = useQuery<Project | undefined>({
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
    refetchOnWindowFocus: false,
  });

  const activeBatchJob = useMemo(() => {
    if (!projectData || !projectData.batchUpdateJobs) {
      return null;
    }

    const active = projectData.batchUpdateJobs.find((job) =>
      ["pending", "running"].includes(job.status)
    );

    return active || null;
  }, [projectData]);

  const { data, isFetching } = useQuery<WithUIState[]>({
    queryKey: ["textbook-structure-detailed", projectID],
    queryFn: async () => {
      const res = await api.getBookPagesDetails(
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );

      if (res.data.err) {
        throw res.data.errMsg;
      }

      const addExpandedState = (
        nodes: TableOfContentsDetailed[],
        isRoot = false
      ): WithUIState[] => {
        return nodes.map((node) => {
          return {
            ...node,
            expanded: node.children.length === 0 ? true : false,
            isRoot,
            children: addExpandedState(node.children),
          };
        });
      };

      const content = res.data.toc?.children || []; // Skip first level, it's the root
      const withUIState = addExpandedState(content, true);

      return withUIState;
    },
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled:
      !!projectData?.libreLibrary &&
      !!projectData?.libreCoverID &&
      !activeBatchJob,
  });

  useEffect(() => {
    if (!data) return;

    // flatten the data recursively
    const flatten = (nodes: WithUIState[]): void => {
      nodes.forEach((node) => {
        const field = fields.find((f) => f.pageID === node.id);
        if (!field) {
          append({
            pageID: node.id,
            overview: node.overview,
            tags: node.tags,
          });
        }
        flatten(node.children);
      });
    };

    flatten(data);
  }, [data]);

  const updateBookPagesMutation = useMutation({
    mutationFn: async (data: FormWorkingData) => {
      const simplified = data.pages.map((p) => ({
        id: p.pageID,
        summary: p.overview,
        tags: p.tags,
      }));

      return api.batchUpdateBookMetadata(
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`,
        simplified
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["project", projectID]); // Refresh the project data (with bulk update jobs)
      queryClient.invalidateQueries(["textbook-structure-detailed", projectID]);
      addNotification({
        type: "success",
        message: "Bulk update job created successfully!",
      });
      setHasMadeChanges(false);
    },
    onError: (error) => {
      handleGlobalError(error);
    },
  });

  async function fetchAISummary(pageID: string) {
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      setLoading(true);
      const res = await api.getPageAISummary(
        `${projectData?.libreLibrary}-${pageID}`,
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );
      if (res.data.err) {
        throw new Error(
          res.data.errMsg || "Failed to generate AI summary for this page."
        );
      }
      if (!res.data.summary) {
        throw new Error("Failed to generate AI summary for this page.");
      }

      const fieldIdx = fields.findIndex((f) => f.pageID === pageID);
      if (!fieldIdx) return;

      setValue(`pages.${fieldIdx}.overview`, res.data.summary);
      setHasMadeChanges(true);
      addNotification({
        type: "success",
        message: "AI summary generated successfully!",
      });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAITags(pageID: string) {
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      setLoading(true);
      const res = await api.getPageAITags(
        `${projectData?.libreLibrary}-${pageID}`,
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );
      if (res.data.err) {
        throw new Error(
          res.data.errMsg || "Failed to generate AI tags for this page."
        );
      }
      if (!res.data.tags) {
        throw new Error("Failed to generate AI tags for this page.");
      }

      const field = fields.find((f) => f.pageID === pageID);
      const fieldIdx = fields.findIndex((f) => f.pageID === pageID);
      if (!field || !fieldIdx) return;

      update(fieldIdx, {
        ...field,
        tags: res.data.tags,
      });

      setHasMadeChanges(true);
      addNotification({
        type: "success",
        message: "AI tags generated successfully!",
      });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveSingleTag(pageID: string, tag: string) {
    setLoading(true);
    const field = fields.find((f) => f.pageID === pageID);
    const fieldIdx = fields.findIndex((f) => f.pageID === pageID);
    if (!field || !fieldIdx) {
      setLoading(false);
      return;
    }

    const updatedTags = field.tags.filter((t) => t !== tag);

    update(fieldIdx, {
      ...field,
      tags: updatedTags,
    });

    setHasMadeChanges(true);
    setLoading(false);
  }

  function handleConfirmRemoveAllOccurrences(tag: string) {
    openModal(
      <ConfirmModal
        text="Are you sure you want to remove this tag from all pages?"
        onConfirm={() => {
          handleDoRemoveAllOccurrences(tag);
          closeAllModals();
        }}
        onCancel={closeAllModals}
        confirmText="Remove"
        confirmColor="red"
      />
    );
  }

  function handleDoRemoveAllOccurrences(tag: string) {
    setLoading(true);
    const updated = fields.map((p) => {
      return {
        ...p,
        tags: p.tags.filter((t) => t !== tag),
      };
    });

    replace(updated);

    setHasMadeChanges(true);
    setLoading(false);
  }

  const isDisabledTag = (value: string): boolean => {
    return DISABLED_PAGE_TAG_PREFIXES.some((prefix) =>
      value?.toString().startsWith(prefix)
    );
  };

  const filterDisabledTags = (arr: string[]): string[] => {
    return arr.filter((tag) => !isDisabledTag(tag));
  };

  function handleConfirmReset() {
    openModal(
      <ConfirmModal
        text="Are you sure you want to abort all changes?"
        onConfirm={() => {
          closeAllModals();
          window.location.reload();
        }}
        onCancel={closeAllModals}
        confirmText="Reset"
        confirmColor="red"
      />
    );
  }

  function handleConfirmSave() {
    openModal(
      <ConfirmModal
        text="Are you sure you want to save these changes? This will create a bulk update job that may take some time to complete. We'll send you an email when it's done."
        onConfirm={async () => {
          await updateBookPagesMutation.mutateAsync({ pages: fields });
          closeAllModals();
        }}
        onCancel={closeAllModals}
        confirmText="Save"
        confirmColor="green"
      />
    );
  }

  const handleOpenBulkAIMetadataModal = () => {
    if (!projectData?.libreLibrary || !projectData?.libreCoverID) {
      return;
    }

    openModal(
      <BulkAIMetadataModal
        projectID={projectID}
        library={projectData?.libreLibrary}
        pageID={projectData?.libreCoverID}
      />
    );
  };

  const handleToggle = (id: string) => {
    const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, expanded: !node.expanded };
        }
        return {
          ...node,
          children: toggleNode(node.children),
        };
      });
    };

    const updatedData = toggleNode(data!);
    queryClient.setQueryData(
      ["textbook-structure-detailed", projectID],
      updatedData
    );
  };

  const handleJumpTo = (to: "top" | "bottom") => {
    window.scrollTo(0, to === "top" ? 0 : document.body.scrollHeight);
  };

  const handleExpandCollapseAll = () => {
    const anyExpanded = data?.some((node) => node.expanded);

    const expandAll = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        return {
          ...node,
          expanded: !anyExpanded,
          children: expandAll(node.children),
        };
      });
    };

    const updatedData = expandAll(data!);
    queryClient.setQueryData(
      ["textbook-structure-detailed", projectID],
      updatedData
    );
  };

  const ActiveJobAlert = (job: ProjectBookBatchUpdateJob) => {
    return (
      <Message icon info>
        <Icon name="info circle" />
        <Message.Content>
          <div className="flex flex-row justify-between">
            <div className="flex flex-col">
              <Message.Header>Bulk Update Job In Progress</Message.Header>

              <p>
                AI-generated metadata is currently being applied. This may take
                some time to complete. Last update: {job.processedPages || 0}{" "}
                successful pages.
              </p>
            </div>
            <Button
              onClick={() => {
                queryClient.invalidateQueries(["project", projectID]);
              }}
              icon
              color="blue"
            >
              <Icon name="refresh" />
            </Button>
          </div>
        </Message.Content>
      </Message>
    );
  };

  const handleOpenBulkUpdateHistoryModal = () => {
    if (!projectData) return;
    openModal(
      <ViewBulkUpdateHistoryModal
        project={projectData}
        onClose={closeAllModals}
      />
    );
  };

  const handleOpenBulkAddTagsModal = () => {
    if (!data) return;

    // flatten all nodes recursively
    const flatten = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.reduce((acc, node) => {
        return [...acc, node, ...flatten(node.children)];
      }, [] as WithUIState[]);
    };

    const availablePages = flatten(data);

    openModal(
      <BulkAddTagModal
        pages={availablePages.map((p) => ({ id: p.id, title: p.title })) || []}
        onCancel={closeAllModals}
        onConfirm={(pages, tags) => {
          handleBulkAddTags(pages, tags);
          closeAllModals();
        }}
      />
    );
  };

  const handleBulkAddTags = (pages: string[], tags: string[]) => {
    setLoading(true);
    const updated = fields.map((p) => {
      if (pages.includes(p.pageID)) {
        return {
          ...p,
          tags: [...new Set([...p.tags, ...tags])],
        };
      }
      return p;
    });

    replace(updated);
    setHasMadeChanges(true);
    setLoading(false);
  };

  const handleOpenSingleAddTagModal = (pageID: string) => {
    openModal(
      <SingleAddTagModal
        pageID={pageID}
        onCancel={closeAllModals}
        onConfirm={(pageID, tag) => {
          handleSingleAddTag(pageID, tag);
          closeAllModals();
        }}
      />
    );
  };

  const handleSingleAddTag = (pageID: string, tag: string) => {
    setLoading(true);
    const field = fields.find((f) => f.pageID === pageID);
    const fieldIdx = fields.findIndex((f) => f.pageID === pageID);
    if (!field || !fieldIdx) return;

    const updatedTags = [...field.tags, tag];
    update(fieldIdx, {
      ...field,
      tags: updatedTags,
    });
    setHasMadeChanges(true);
    setLoading(false);
  };

  const LoadingSkeleton = () => {
    return (
      <Placeholder>
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
        <PlaceholderLine />
      </Placeholder>
    );
  };

  const TagLabel = ({ pageID, tag }: { pageID: string; tag: string }) => {
    return (
      <Label
        key={crypto.randomUUID()}
        style={{
          backgroundColor: "#155789",
        }}
        onClick={() => {
          handleRemoveSingleTag(pageID, tag);
        }}
        onContextMenu={(e: any) => {
          e.preventDefault();
          handleConfirmRemoveAllOccurrences(tag);
        }}
        className="cursor-pointer !text-white"
      >
        {tag}
      </Label>
    );
  };

  const renderEditor = (node: WithUIState, indentLevel = 1) => {
    const field = fields.find((f) => f.pageID === node.id);
    const fieldIdx = fields.findIndex((f) => f.pageID === node.id);
    if (!field) return null;

    const hasChildren = node.children && node.children.length !== 0;
    const tags = filterDisabledTags(field.tags);

    const getIndent = () => {
      if (indentLevel <= 2) return "!ml-4";
      if (indentLevel === 3 && !hasChildren) return "!ml-4";
      if (indentLevel === 3 && hasChildren) return "!ml-12";
      return `!ml-${indentLevel * 3}`;
    };

    const indent = getIndent();

    return (
      <div
        key={field.id}
        className={`flex flex-col border-slate-300 border rounded-md px-3 pb-2 shadow-sm bg-gray-50 ${indent}`}
      >
        <div className="flex flex-row justify-between items-center mt-2">
          <p className="font-semibold text-lg">{node.title}</p>
        </div>
        <div className="flex flex-row justify-between items-start">
          <CtlTextArea
            control={control}
            name={`pages.${fieldIdx}.overview`}
            className="!w-full mt-0.5"
            fluid
            bordered
            showRemaining
            rows={4}
            maxLength={500}
            disabled={loading}
            placeholder="Enter a page summary here..."
          />
          <div className="flex flex-col items-start ml-4 justify-start mt-1">
            <Button
              as={Link}
              to={node.url}
              target="_blank"
              icon
              style={{ backgroundColor: "#155789" }}
              className="!text-white"
            >
              <Icon name="external alternate" />
            </Button>
            <Button
              icon
              disabled={loading}
              loading={loading}
              style={{ backgroundColor: "#155789" }}
              className="!text-white !mt-2"
              onClick={() => fetchAISummary(node.id)}
            >
              <Icon name="magic" />
            </Button>
          </div>
        </div>
        <div className="border-t border-slate-300 mt-2 pt-2 w-full">
          <div className="flex flex-row justify-between">
            <div className="space-y-1">
              {tags.map((t) => (
                <TagLabel pageID={node.id} tag={t} />
              ))}
            </div>
            <div className="flex flex-col ">
              <Button
                icon
                style={{ backgroundColor: "#155789" }}
                className="!text-white"
                onClick={() => {
                  handleOpenSingleAddTagModal(node.id);
                }}
              >
                <Icon name="plus" />
              </Button>
              <Button
                icon
                style={{ backgroundColor: "#155789" }}
                className="!text-white !mt-2"
                onClick={() => fetchAITags(node.id)}
                loading={loading}
                disabled={loading}
              >
                <Icon name="magic" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-row justify-end mt-2 w-full">
          <p className="text-xs">ID: {node.id}</p>
        </div>
      </div>
    );
  };

  const renderNodes = (nodes: WithUIState[], indentLevel = 1) => {
    if (!projectData?.libreLibrary || !projectData?.libreCoverID) {
      return (
        <div>
          <p>
            This project does not have a textbook associated with it. Please
            return to the main project page to create or connect one.
          </p>
        </div>
      );
    }
    return (
      <Accordion fluid className="!py-0 !my-0">
        {nodes.map((node, idx) => {
          const hasChildren = node.children && node.children.length !== 0;
          return (
            <>
              <Accordion.Title
                className={`flex justify-between items-center border-slate-300 ${
                  node.expanded ? " !pr-3" : ""
                }`}
                key={`tree-node-${node.id}-${idx}`}
                active={node.expanded}
                style={{
                  marginLeft: indentLevel === 1 ? "" : `${indentLevel}rem`,
                }}
              >
                {hasChildren && (
                  <div>
                    {node.children && node.children.length !== 0 && (
                      <Icon
                        className="cursor-pointer"
                        name={node.expanded ? "caret down" : "caret right"}
                        onClick={(e: any) => {
                          e.preventDefault();
                          handleToggle(node.id);
                        }}
                      />
                    )}
                    <Link to={node.url} target="_blank">
                      {node.title}
                    </Link>
                  </div>
                )}
              </Accordion.Title>
              <Accordion.Content active={node.expanded} className="!p-0">
                {node.expanded && renderEditor(node, indentLevel + 1)}
                {node.children &&
                  node.expanded &&
                  renderNodes(node.children, indentLevel + 1)}
              </Accordion.Content>
            </>
          );
        })}
      </Accordion>
    );
  };

  return (
    <Grid className="component-container">
      <Grid.Column>
        <Header as="h2" dividing className="component-header">
          AI Co-Author: <span className="italic">{projectData?.title}</span>
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          <Segment>
            <Breadcrumb>
              <Breadcrumb.Section as={Link} to="/projects">
                Projects
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section as={Link} to={`/projects/${projectID}`}>
                {projectData?.title || "Loading..."}
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section active>AI Co-Author</Breadcrumb.Section>
            </Breadcrumb>
          </Segment>
          <Segment className="flex flex-row items-center">
            <p className="font-semibold">
              Welcome to LibreTexts' AI Co-Author tool. Here, you can curate
              AI-generated metadata for your textbook. You can generate and edit
              metadata for individual pages below, or use the bulk actions to
              generate metadata for all pages at once.
            </p>
            <img
              src="https://cdn.libretexts.net/Images/benny-mascot-white.png"
              alt="Benny the LibreTexts Mascot"
              className="ml-9 h-20 w-20"
            />
          </Segment>
          {activeBatchJob && (
            <Segment>
              <ActiveJobAlert {...activeBatchJob} />
            </Segment>
          )}
          <Segment>
            {(isFetching || updateBookPagesMutation.isLoading) && (
              <div className="my-4r">
                <LoadingSpinner text="Loading content... This may take a moment" />
              </div>
            )}
            <div className="flex flex-row justify-between">
              <div>
                <p className="text-lg max-w-7xl">
                  <span className="font-semibold">Editing Summaries:</span> Use
                  the magic wand icon to generate an AI summary for the page.
                  This will replace the current summary with the AI-generated
                  one, which you can then edit further.
                </p>

                <p className="text-lg max-w-7xl mt-4">
                  <span className="font-semibold">Editing Tags:</span> Use the
                  magic wand icon to generate AI tags for the page. You can then
                  left-click on a tag to remove it from that page, or
                  right-click on a tag to remove it from <em>all</em> pages. You
                  can also add individual tags to a page with the plus icon, or
                  use the bulk actions to add tags to multiple pages at once.
                </p>
              </div>
              <div className="flex flex-col justify-start">
                <ButtonGroup color="blue" size="medium">
                  <Button
                    onClick={() => setBulkActionsOpen(!bulkActionsOpen)}
                    className="!rounded-md"
                  >
                    <Icon name="bolt" />
                    Bulk Actions
                  </Button>
                  <Dropdown
                    text="Bulk Actions"
                    floating
                    labeled
                    open={bulkActionsOpen}
                    onClose={() => setBulkActionsOpen(false)}
                  >
                    <DropdownMenu>
                      <DropdownItem
                        icon="magic"
                        content="Generate AI Metadata"
                        onClick={handleOpenBulkAIMetadataModal}
                        disabled={!!activeBatchJob}
                      />
                      <DropdownItem
                        icon="tags"
                        content="Add Tags"
                        onClick={handleOpenBulkAddTagsModal}
                        disabled={!!activeBatchJob}
                      />
                      <DropdownItem
                        icon="list"
                        content="View Bulk Update History"
                        onClick={handleOpenBulkUpdateHistoryModal}
                      />
                    </DropdownMenu>
                  </Dropdown>
                </ButtonGroup>
              </div>
            </div>
            {!activeBatchJob && (
              <>
                <div className="flex flex-row justify-center mt-6 border-t border-b border-slate-300 py-4 my-4">
                  <Button
                    onClick={() => handleJumpTo("bottom")}
                    icon
                    title="Jump to Bottom"
                  >
                    <Icon name="arrow down" />
                  </Button>
                  <Button
                    onClick={handleExpandCollapseAll}
                    icon
                    title="Expand/Collapse All"
                  >
                    <Icon name="expand arrows alternate" />
                  </Button>
                  <Button
                    onClick={handleConfirmReset}
                    disabled={!hasMadeChanges}
                    loading={updateBookPagesMutation.isLoading}
                    color="red"
                  >
                    <Icon name="refresh" />
                    Reset
                  </Button>
                  <Button
                    color="green"
                    onClick={handleConfirmSave}
                    disabled={!hasMadeChanges}
                    loading={updateBookPagesMutation.isLoading}
                  >
                    <Icon name="save" />
                    Save Changes
                  </Button>
                </div>
                {isFetching && <LoadingSkeleton />}
                {data && renderNodes(data)}
                <div className="flex flex-row justify-center mt-6">
                  <Button
                    onClick={() => handleJumpTo("top")}
                    icon
                    title="Jump to Top"
                  >
                    <Icon name="arrow up" />
                  </Button>
                  <Button
                    onClick={handleExpandCollapseAll}
                    icon
                    title="Expand/Collapse All"
                  >
                    <Icon name="expand arrows alternate" />
                  </Button>
                </div>
              </>
            )}
          </Segment>
        </Segment.Group>
      </Grid.Column>
    </Grid>
  );
};

export default TextbookCuration;
