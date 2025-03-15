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
import { Fragment, useEffect, useMemo, useReducer, useState } from "react";
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
import ActiveJobAlert from "../../../../components/projects/TextbookCuration/ActiveJobAlert";

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

type NodeStateReducerAction =
  | {
      type: "SET_LOADING";
      id: string;
      loading: boolean;
    }
  | {
      type: "SET_EDITED";
      id: string;
      edited: boolean;
    }
  | {
      type: "SET_EXPANDED";
      id: string;
      expanded: boolean;
    }
  | {
      type: "EXPAND_COLLAPSE_ALL";
    }
  | {
      type: "UPDATE_SINGLE_NODE";
      id: string;
      data: Partial<Omit<WithUIState, "id">>;
    }
  | {
      type: "UPDATE_MANY_NODES";
      ids: string[];
      data: Partial<Omit<WithUIState, "id">>;
    }
  | {
      type: "SET_NODE_DATA";
      data: WithUIState[];
    };

function nodeStateReducer(
  state: WithUIState[],
  action: NodeStateReducerAction
) {
  switch (action.type) {
    case "SET_LOADING": {
      const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          if (node.id === action.id) {
            return { ...node, loading: action.loading };
          }
          return {
            ...node,
            children: toggleNode(node.children),
          };
        });
      };
      const newState = toggleNode(state);
      return newState;
    }
    case "SET_EDITED": {
      const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          if (node.id === action.id) {
            return { ...node, edited: action.edited };
          }
          return {
            ...node,
            children: toggleNode(node.children),
          };
        });
      };
      const newState = toggleNode(state);
      return newState;
    }
    case "SET_EXPANDED": {
      const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          if (node.id === action.id) {
            return { ...node, expanded: action.expanded };
          }
          return {
            ...node,
            children: toggleNode(node.children),
          };
        });
      };
      const newState = toggleNode(state);
      return newState;
    }
    case "EXPAND_COLLAPSE_ALL": {
      const expandedLocalStorage = localStorage.getItem(
        "conductor_all_expanded"
      );
      const currentExpanded = expandedLocalStorage === "true";

      const expandAll = (
        nodes: WithUIState[],
        newState: boolean
      ): WithUIState[] => {
        return nodes.map((node) => {
          return {
            ...node,
            expanded: newState,
            // children: expandAll(node.children, newState), // TODO: need to investigate nested expansion oddities, but this seems to work for now
          };
        });
      };

      localStorage.setItem(
        "conductor_all_expanded",
        (!currentExpanded).toString()
      );
      return expandAll(state, !currentExpanded);
    }
    case "UPDATE_SINGLE_NODE": {
      const updateNode = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          if (node.id === action.id) {
            return {
              ...node,
              ...action.data,
              children: updateNode(node.children),
            };
          }
          return {
            ...node,
            children: updateNode(node.children),
          };
        });
      };
      return updateNode(state);
    }
    case "UPDATE_MANY_NODES": {
      const updateNodes = (nodes: WithUIState[]): WithUIState[] => {
        return nodes.map((node) => {
          if (action.ids.includes(node.id)) {
            return {
              ...node,
              ...action.data,
              children: updateNodes(node.children),
            };
          }
          return {
            ...node,
            children: updateNodes(node.children),
          };
        });
      };
      return updateNodes(state);
    }
    case "SET_NODE_DATA": {
      return action.data;
    }
    default:
      return state;
  }
}

const TextbookCuration = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [bulkActionsOpen, setBulkActionsOpen] = useState<boolean>(false);
  const [showSystemTags, setShowSystemTags] = useState<boolean>(false);
  const [nodeState, dispatch] = useReducer(nodeStateReducer, []);

  const { control, setValue, watch, getValues } = useForm<FormWorkingData>();
  const { fields, append } = useFieldArray({
    control,
    name: "pages",
  });

  const hasMadeChanges = useMemo<boolean>(() => {
    const flattened = nodeState.reduce((acc, node) => {
      return [...acc, node, ...node.children];
    }, [] as WithUIState[]);

    return flattened.some((node) => node.edited);
  }, [nodeState]);

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
      dispatch({ type: "SET_NODE_DATA", data: withUIState });

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

  const updateBookPagesMutation = useMutation({
    mutationFn: async (workingData: FormWorkingData) => {
      const pagesToUpdate = getPagesToUpdate(workingData);
      if (!pagesToUpdate) {
        return null;
      }

      return api.batchUpdateBookMetadata(
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`,
        pagesToUpdate
      );
    },
    onSettled: async (data) => {
      if (!data || data.data.err) {
        addNotification({
          type: "error",
          message: "Failed to create bulk update job. Please try again later.",
        });
        await queryClient.invalidateQueries(["project", projectID]); // Refresh the project data (with bulk update jobs)
        return;
      }

      const message = data.data.msg;
      addNotification({
        type: "success",
        message,
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
      window.location.reload();
    },
    onError: (error) => {
      handleGlobalError(error);
    },
  });

  function getPagesToUpdate(workingData: FormWorkingData) {
    // first, flat map node data so we can easily find edited pages
    const flattened: WithUIState[] = [];
    const flatNodeData = (nodes: WithUIState[]) => {
      nodes.forEach((node) => {
        flattened.push(node);
        flatNodeData(node.children);
      });
    };
    flatNodeData(nodeState);

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

    return Array.from(simplifiedSet).map((s) => JSON.parse(s));
  }

  async function handleInitSave() {
    const pagesToUpdate = getPagesToUpdate(getValues());
    if (!pagesToUpdate || pagesToUpdate.length === 0) return;
    if (pagesToUpdate.length <= 10) {
      await updateBookPagesMutation.mutateAsync({
        pages: getValues("pages"),
      });
    } else {
      handleConfirmSave();
    }
  }

  async function fetchAISummary(pageID: string) {
    let success = false;
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      dispatch({ type: "SET_LOADING", id: pageID, loading: true });

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
      dispatch({
        type: "UPDATE_SINGLE_NODE",
        id: pageID,
        data: { loading: false, edited: success },
      });
    }
  }

  async function fetchAITags(pageID: string) {
    let success = false;
    try {
      if (!projectData?.libreLibrary || !pageID) return null;

      dispatch({ type: "SET_LOADING", id: pageID, loading: true });

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
      dispatch({
        type: "UPDATE_SINGLE_NODE",
        id: pageID,
        data: { loading: false, edited: success },
      });
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
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
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

    const modified: { pageID: string; overview: string; tags: string[] }[] = [];
    // Get all pages and remove the tag from each
    for (let i = 0; i < pagesValues.length; i++) {
      const p = pagesValues[i];
      if (p.tags.includes(tag)) {
        modified.push({
          ...p,
          tags: p.tags.filter((t) => t !== tag),
        });
      }
    }

    for (let i = 0; i < modified.length; i++) {
      const idx = pagesValues.findIndex((p) => p.pageID === modified[i].pageID);
      if (!idx) continue;
      setValue(`pages.${idx}.tags`, modified[i].tags);
    }

    dispatch({
      type: "UPDATE_MANY_NODES",
      ids: modified.map((m) => m.pageID),
      data: { edited: true },
    });
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

  const handleJumpTo = (to: "top" | "bottom") => {
    window.scrollTo(0, to === "top" ? 0 : document.body.scrollHeight);
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
    if (!nodeState) return;

    // flatten all nodes recursively
    const flatten = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.reduce((acc, node) => {
        return [...acc, node, ...flatten(node.children)];
      }, [] as WithUIState[]);
    };

    const availablePages = flatten(nodeState);

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

    const modified: { pageID: string; overview: string; tags: string[] }[] = [];
    // Get all pages and add the tags to each
    for (let i = 0; i < pagesValues.length; i++) {
      const p = pagesValues[i];
      if (pages.includes(p.pageID)) {
        modified.push({
          ...p,
          tags: [...p.tags, ...tags],
        });
      }
    }

    for (let i = 0; i < modified.length; i++) {
      const idx = pagesValues.findIndex((p) => p.pageID === modified[i].pageID);
      if (!idx) continue;
      setValue(`pages.${idx}.tags`, modified[i].tags);
    }

    dispatch({
      type: "UPDATE_MANY_NODES",
      ids: modified.map((m) => m.pageID),
      data: { edited: true },
    });

    addNotification({
      type: "success",
      message: "Tags added to selected pages.",
    });
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
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
  };

  const handleUpdateSummary = (pageID: string, value: string) => {
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (fieldIdx === undefined) {
      return;
    }

    setValue(`pages.${fieldIdx}.overview`, value);
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
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
      <Accordion fluid className="!py-0 !my-0" key={`tree-node-${indentLevel}`}>
        {nodes.map((node, idx) => {
          const hasChildren = node.children && node.children.length !== 0;
          const fieldIdx = getValues("pages").findIndex(
            (f) => f.pageID === node.id
          );
          return (
            <Fragment key={`tree-node-${node.id}-${idx}`}>
              <Accordion.Title
                className={`flex justify-between items-center border-slate-300 ${
                  node.expanded ? " !pr-3" : ""
                }`}
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
                          dispatch({
                            type: "SET_EXPANDED",
                            id: node.id,
                            expanded: !node.expanded,
                          });
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
            </Fragment>
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
              <ActiveJobAlert
                job={activeBatchJob}
                onRefresh={() => refreshActiveJobStatusMutation.mutate()}
                loading={refreshActiveJobStatusMutation.isLoading}
              />
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
                    onClick={() => dispatch({ type: "EXPAND_COLLAPSE_ALL" })}
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
                    onClick={handleInitSave}
                    disabled={!hasMadeChanges}
                    loading={updateBookPagesMutation.isLoading}
                    title="Save Changes"
                  >
                    <Icon name="save" />
                    Save Changes
                  </Button>
                </div>
                {isFetching && <LoadingSkeleton />}
                {nodeState && renderNodes(nodeState)}
                <div className="flex flex-row justify-center mt-6">
                  <Button
                    onClick={() => handleJumpTo("top")}
                    icon
                    title="Jump to Top"
                  >
                    <Icon name="arrow up" />
                  </Button>
                  <Button
                    onClick={() => dispatch({ type: "EXPAND_COLLAPSE_ALL" })}
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
