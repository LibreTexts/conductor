import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Segment,
  Accordion,
  Message,
  Placeholder,
  PlaceholderLine,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  ButtonGroup,
  Checkbox,
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
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom-v5-compat";
import ConfirmModal from "../../../../components/ConfirmModal";
import { useFieldArray, useForm } from "react-hook-form";
import BulkAIMetadataModal from "../../../../components/projects/TextbookCuration/BulkAIMetadataModal";
import BulkAddTagModal from "../../../../components/projects/TextbookCuration/BulkAddTagModal";
import SingleAddTagModal from "../../../../components/projects/TextbookCuration/SingleAddTagModal";
import ViewBulkUpdateHistoryModal from "../../../../components/projects/TextbookCuration/ViewBulkUpdateHistoryModal";
import WelcomeToCoAuthorModal from "../../../../components/projects/TextbookCuration/WelcomeToCoAuthorModal";
import NodeEditor from "../../../../components/projects/TextbookCuration/NodeEditor";
import { useTypedSelector } from "../../../../state/hooks";
import GeneratePageImagesAltTextModal from "../../../../components/projects/TextbookCuration/GeneratePageImagesAltTextModal";

type WithUIState = Prettify<
  Omit<TableOfContentsDetailed, "children"> & {
    expanded: boolean;
    loading: boolean;
    edited: boolean;
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
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [bulkActionsOpen, setBulkActionsOpen] = useState<boolean>(false);
  const [nodeData, setNodeData] = useState<WithUIState[]>([]);
  const [hasMadeChanges, setHasMadeChanges] = useState<boolean>(false);
  const [showSystemTags, setShowSystemTags] = useState<boolean>(false);

  const { control, setValue, watch, getValues } = useForm<FormWorkingData>();
  const { fields, append } = useFieldArray({
    control,
    name: "pages",
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

  const { data: _data, isFetching } = useQuery<WithUIState[]>({
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
            loading: false,
            edited: false,
            isRoot,
            children: addExpandedState(node.children),
          };
        });
      };

      const content = res.data.toc?.children || []; // Skip first level, it's the root
      const withUIState = addExpandedState(content, true);

      // flatten the data recursively
      const flatten = (nodes: WithUIState[]): void => {
        nodes.forEach((node) => {
          append({
            pageID: node.id,
            overview: node.overview,
            tags: node.tags,
          });
          flatten(node.children);
        });
      };

      flatten(withUIState);
      setNodeData(withUIState);

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
    if (
      window.localStorage.getItem("conductor_show_coauthor_welcome") === "false"
    )
      return;
    openModal(<WelcomeToCoAuthorModal onClose={closeAllModals} />);
  }, [window.localStorage]);

  useEffect(() => {
    if (isSuperAdmin) {
      setShowSystemTags(true); // Show system tags by default for super admins
    }
  }, [isSuperAdmin]);

  const updateBookPagesMutation = useMutation({
    mutationFn: async (workingData: FormWorkingData) => {
      // first, flat map node data so we can easily find edited pages
      const flattened: WithUIState[] = [];
      const flatNodeData = (nodes: WithUIState[]) => {
        nodes.forEach((node) => {
          flattened.push(node);
          flatNodeData(node.children);
        });
      };
      flatNodeData(nodeData);

      // Only send edited pages for update
      const editedNodes = flattened.filter((node) => node.edited);
      const editedPages = workingData.pages.filter((p) =>
        editedNodes?.some((n) => n.id === p.pageID)
      );

      const simplified = editedPages.map((p) => ({
        id: p.pageID,
        summary: p.overview,
        tags: p.tags,
      }));

      const simplifiedSet = new Set(simplified.map((s) => JSON.stringify(s)));

      if (simplifiedSet.size === 0) {
        return null;
      }

      const simplifiedArr = Array.from(simplifiedSet).map((s) => JSON.parse(s));

      return api.batchUpdateBookMetadata(
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`,
        simplifiedArr
      );
    },
    onSettled: async () => {
      addNotification({
        type: "success",
        message: "Bulk update job created successfully!",
      });

      await queryClient.invalidateQueries(["project", projectID]); // Refresh the project data (with bulk update jobs)
      await queryClient.invalidateQueries([
        "textbook-structure-detailed",
        projectID,
      ]);
    },
    onError: (error) => {
      handleGlobalError(error);
    },
  });

  const refreshActiveJobStatusMutation = useMutation({
    mutationFn: async () => {
      queryClient.invalidateQueries(["project", projectID]);
      queryClient.invalidateQueries(["textbook-structure-detailed", projectID]);
    },
    onError: (error) => {
      handleGlobalError(error);
    },
  });

  async function fetchAISummary(pageID: string) {
    let success = false;
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      handleSetNodeLoading(pageID, true);

      const res = await api.getPageAISummary(
        `${projectData?.libreLibrary}-${pageID}`,
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );
      if (res.data.err) {
        throw new Error(
          res.data.errMsg ||
            "Failed to generate AI summary for this page. It may have insufficient content."
        );
      }
      if (!res.data.summary) {
        throw new Error(
          "Failed to generate AI summary for this page. It may have insufficient content."
        );
      }

      const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
      if (fieldIdx === undefined) return;

      setValue(`pages.${fieldIdx}.overview`, res.data.summary);
      success = true;
      addNotification({
        type: "success",
        message: "AI summary generated successfully!",
      });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      handleUpdateSingleNode(pageID, { loading: false, edited: success });
    }
  }

  async function fetchAITags(pageID: string) {
    let success = false;
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      handleSetNodeLoading(pageID, true);

      const res = await api.getPageAITags(
        `${projectData?.libreLibrary}-${pageID}`,
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );
      if (res.data.err) {
        throw new Error(
          res.data.errMsg ||
            "Failed to generate AI tags for this page. It may have insufficient content."
        );
      }
      if (
        !res.data.tags ||
        res.data.tags.length === 0 ||
        res.data.tags.every((t: string) => t === "")
      ) {
        throw new Error(
          "Failed to generate AI tags for this page. It may have insufficient content."
        );
      }

      const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
      if (fieldIdx === undefined) {
        return;
      }

      setValue(`pages.${fieldIdx}.tags`, res.data.tags);
      success = true;
      addNotification({
        type: "success",
        message: "AI tags generated successfully!",
      });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      handleUpdateSingleNode(pageID, { loading: false, edited: success });
    }
  }

  function handleRemoveSingleTag(pageID: string, tag: string) {
    const field = getValues("pages").find((f) => f.pageID === pageID);
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (!field || fieldIdx === undefined) {
      return;
    }

    const updatedTags = field.tags.filter((t) => t !== tag);

    setValue(`pages.${fieldIdx}.tags`, updatedTags);
    handleSetNodeEdited(pageID);
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
    const pagesValues = getValues("pages");
    const updated = pagesValues.map((p) => {
      return {
        ...p,
        tags: p.tags.filter((t) => t !== tag),
      };
    });

    for (let i = 0; i < updated.length; i++) {
      setValue(`pages.${i}.tags`, updated[i].tags);
    }
    handleSetNodeEdited("all");
  }

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
          updateBookPagesMutation.mutate({
            pages: getValues("pages"),
          });
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

  const handleOpenGeneratePageImagesAltTextModal = (pageID: string) => {
    if (!projectData?.libreCoverID) return;
    openModal(
      <GeneratePageImagesAltTextModal
        coverPageID={`${projectData?.libreLibrary}-${projectData?.libreCoverID}`}
        fullPageID={`${projectData?.libreLibrary}-${pageID}`}
        onClose={closeAllModals}
      />
    );
  };

  const handleToggle = (id: string, currentState: boolean) => {
    const toggleNodes = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            expanded: !currentState,
            children: toggleNodes(node.children),
          };
        }
        return {
          ...node,
          children: toggleNodes(node.children),
        };
      });
    };

    setNodeData(toggleNodes(nodeData));
  };

  const handleJumpTo = (to: "top" | "bottom") => {
    window.scrollTo(0, to === "top" ? 0 : document.body.scrollHeight);
  };

  // Useful to avoid race conditions/multiple re-renders when the same node will be updated multiple times in quick succession
  // (ie. loading: true, then edited: true, then loading: false again)
  const handleUpdateSingleNode = (
    id: string,
    data: Partial<Omit<WithUIState, "id">>
  ) => {
    const updateNode = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            ...data,
            children: updateNode(node.children),
          };
        }
        return {
          ...node,
          children: updateNode(node.children),
        };
      });
    };
    setNodeData(updateNode(nodeData));
  };

  const handleSetNodeLoading = (id: string, loading: boolean) => {
    const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, loading };
        }
        return {
          ...node,
          children: toggleNode(node.children),
        };
      });
    };

    setNodeData(toggleNode(nodeData));
  };

  const handleSetNodeEdited = (id: string | "all") => {
    if (id === "all") {
      // recursively set all nodes to edited
      const toggleAllNodes = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          return {
            ...node,
            edited: true,
            children: toggleAllNodes(node.children),
          };
        });
      };

      return;
    }

    const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, edited: true };
        }
        return {
          ...node,
          children: toggleNode(node.children),
        };
      });
    };

    setNodeData(toggleNode(nodeData));
    setHasMadeChanges(true);
  };

  const handleExpandCollapseAll = () => {
    // Find if any nodes are expanded recursively
    const findExpanded = (nodes: WithUIState[]): boolean => {
      return nodes.some((node) => {
        return node.expanded || findExpanded(node.children);
      });
    };

    const anyExpanded = findExpanded(nodeData);

    const expandAll = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        return {
          ...node,
          expanded: !anyExpanded,
          children: expandAll(node.children),
        };
      });
    };

    setNodeData(expandAll(nodeData));
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
                some time to complete.
              </p>
            </div>
            <Button
              onClick={async () => {
                await refreshActiveJobStatusMutation.mutateAsync();
              }}
              icon
              color="blue"
              loading={refreshActiveJobStatusMutation.isLoading}
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
    if (!nodeData) return;

    // flatten all nodes recursively
    const flatten = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.reduce((acc, node) => {
        return [...acc, node, ...flatten(node.children)];
      }, [] as WithUIState[]);
    };

    const availablePages = flatten(nodeData);

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
    const pagesValues = getValues("pages");

    // Trim whitespace from tags
    tags.forEach((t) => t.trim());

    const updated = pagesValues.map((p) => {
      if (pages.includes(p.pageID)) {
        return {
          ...p,
          tags: [...new Set([...p.tags, ...tags])],
        };
      }
      return p;
    });

    for (let i = 0; i < updated.length; i++) {
      setValue(`pages.${i}.tags`, updated[i].tags);
    }
    setHasMadeChanges(true);
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
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (fieldIdx === undefined) {
      return;
    }

    const withNew = [...getValues(`pages.${fieldIdx}.tags`), tag.trim()];
    const setTags = [...new Set(withNew)];
    setValue(`pages.${fieldIdx}.tags`, setTags);
    handleSetNodeEdited(pageID);
  };

  const handleUpdateSummary = (pageID: string, value: string) => {
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (fieldIdx === undefined) {
      return;
    }

    setValue(`pages.${fieldIdx}.overview`, value);
    handleSetNodeEdited(pageID);
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
      <Accordion fluid className="!py-0 !my-0" key="tree-node-root">
        {nodes.map((node, idx) => {
          const hasChildren = node.children && node.children.length !== 0;
          const fieldIdx = getValues("pages").findIndex(
            (f) => f.pageID === node.id
          );
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
                          handleToggle(node.id, node.expanded);
                        }}
                      />
                    )}
                    <a href={node.url} target="_blank">
                      {node.title}
                    </a>
                  </div>
                )}
              </Accordion.Title>
              <Accordion.Content active={node.expanded} className="!p-0">
                {node.expanded && (
                  <NodeEditor
                    node={node}
                    indentLevel={indentLevel}
                    control={control}
                    fields={fields}
                    tags={watch(`pages.${fieldIdx}.tags`)}
                    onRemoveSingleTag={handleRemoveSingleTag}
                    onRemoveAllOccurrences={handleConfirmRemoveAllOccurrences}
                    onUpdateSummary={handleUpdateSummary}
                    onAddSingleTag={handleOpenSingleAddTagModal}
                    onFetchAISummary={fetchAISummary}
                    onFetchAITags={fetchAITags}
                    onGeneratePageImagesAltText={
                      handleOpenGeneratePageImagesAltTextModal
                    }
                    showSystemTags={showSystemTags}
                  />
                )}
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
          <Segment className="flex flex-row justify-between items-center">
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
            {isSuperAdmin && (
              <Checkbox
                label="Show System Tags (Admins)"
                toggle
                checked={showSystemTags}
                onChange={() => setShowSystemTags(!showSystemTags)}
              />
            )}
          </Segment>
          <Segment className="flex flex-row items-center">
            <p className="font-semibold">
              Welcome to LibreTexts' AI Co-Author tool. Here, you can curate
              AI-generated metadata for your textbook. You can generate and edit
              metadata for individual pages below, or use the bulk actions to
              generate metadata for all pages at once and return here to refine
              it.
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
              <div className="my-16">
                <LoadingSpinner text="Loading content... This may take a moment" />
              </div>
            )}
            <div className="flex flex-row justify-between">
              <div className="flex flex-col">
                <p className="text-lg max-w-7xl">
                  <span className="font-semibold">Editing Summaries:</span> Use
                  "Generate Summary" button to generate an AI summary for that
                  page. This will replace the current summary with the
                  AI-generated one, which you can then edit further.
                </p>

                <p className="text-lg max-w-7xl mt-4">
                  <span className="font-semibold">Editing Tags:</span> Use the
                  "Generate Tags" to generate new tags for the page. You can
                  click the "X" icon to remove a tag from that page, or click
                  the trash icon to remove it from <em>all</em> pages. You can
                  also add individual tags to a page with the plus icon, or use
                  the bulk actions to add tags to multiple pages at once.
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
                    <Icon name="arrows alternate vertical" />
                  </Button>
                  <Button
                    onClick={handleConfirmReset}
                    disabled={!hasMadeChanges}
                    loading={updateBookPagesMutation.isLoading}
                    color="red"
                    title="Reset All Changes"
                  >
                    <Icon name="refresh" />
                    Reset
                  </Button>
                  <Button
                    color="green"
                    onClick={handleConfirmSave}
                    disabled={!hasMadeChanges}
                    loading={updateBookPagesMutation.isLoading}
                    title="Save Changes"
                  >
                    <Icon name="save" />
                    Save Changes
                  </Button>
                </div>
                {isFetching && <LoadingSkeleton />}
                {nodeData && renderNodes(nodeData)}
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
                    <Icon name="arrows alternate vertical" />
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
