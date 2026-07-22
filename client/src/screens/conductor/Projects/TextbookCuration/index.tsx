import { Breadcrumb, Button, Checkbox } from "@libretexts/davis-react";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsUpDown,
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconDeviceFloppy,
  IconList,
  IconRefresh,
  IconSparkles,
  IconTags,
} from "@tabler/icons-react";
import { useModals } from "../../../../context/ModalContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import {
  FormWorkingData,
  Prettify,
  TableOfContentsDetailed,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useNotifications } from "../../../../context/NotificationContext";
import "../../../../components/projects/Projects.css";
import { useHistory, useParams } from "react-router-dom";
import React, {
  Fragment,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom-v5-compat";
import ConfirmModal from "../../../../components/ConfirmModal";
import { useFieldArray, useForm } from "react-hook-form";
import BulkAddTagModal from "../../../../components/projects/TextbookCuration/BulkAddTagModal";
import SingleAddTagModal from "../../../../components/projects/TextbookCuration/SingleAddTagModal";
import ViewBulkUpdateHistoryModal from "../../../../components/projects/TextbookCuration/ViewBulkUpdateHistoryModal";
import WelcomeToCoAuthorModal from "../../../../components/projects/TextbookCuration/WelcomeToCoAuthorModal";
import NodeEditor from "../../../../components/projects/TextbookCuration/NodeEditor";
import { useTypedSelector } from "../../../../state/hooks";
import GeneratePageImagesAltTextModal from "../../../../components/projects/TextbookCuration/GeneratePageImagesAltTextModal";
import ActiveJobAlert from "../../../../components/projects/TextbookCuration/ActiveJobAlert";
import useProject from "../../../../hooks/useProject";
import BatchUpdateModal from "../../../../components/projects/TextbookCuration/BatchUpdateModal";
import useProjectBatchUpdateJobs from "../../../../hooks/useProjectBatchUpdateJobs";

type WithUIState = Prettify<
  Omit<TableOfContentsDetailed, "children"> & {
    expanded: boolean;
    loading: boolean;
    edited: boolean;
    isRoot: boolean;
    children: WithUIState[];
  }
>;

type NodeStateReducerAction =
  | { type: "SET_LOADING"; id: string; loading: boolean }
  | { type: "SET_EDITED"; id: string; edited: boolean }
  | { type: "SET_EXPANDED"; id: string; expanded: boolean }
  | { type: "EXPAND_COLLAPSE_ALL" }
  | { type: "UPDATE_SINGLE_NODE"; id: string; data: Partial<Omit<WithUIState, "id">> }
  | { type: "UPDATE_MANY_NODES"; ids: string[]; data: Partial<Omit<WithUIState, "id">> }
  | { type: "SET_NODE_DATA"; data: WithUIState[] };

function nodeStateReducer(state: WithUIState[], action: NodeStateReducerAction) {
  switch (action.type) {
    case "SET_LOADING": {
      const toggle = (nodes: WithUIState[]): WithUIState[] =>
        nodes.map((n) => n.id === action.id ? { ...n, loading: action.loading } : { ...n, children: toggle(n.children) });
      return toggle(state);
    }
    case "SET_EDITED": {
      const toggle = (nodes: WithUIState[]): WithUIState[] =>
        nodes.map((n) => n.id === action.id ? { ...n, edited: action.edited } : { ...n, children: toggle(n.children) });
      return toggle(state);
    }
    case "SET_EXPANDED": {
      const toggle = (nodes: WithUIState[]): WithUIState[] =>
        nodes.map((n) => n.id === action.id ? { ...n, expanded: action.expanded } : { ...n, children: toggle(n.children) });
      return toggle(state);
    }
    case "EXPAND_COLLAPSE_ALL": {
      const currentExpanded = localStorage.getItem("conductor_all_expanded") === "true";
      const expandAll = (nodes: WithUIState[], newState: boolean): WithUIState[] =>
        nodes.map((n) => ({ ...n, expanded: newState }));
      localStorage.setItem("conductor_all_expanded", (!currentExpanded).toString());
      return expandAll(state, !currentExpanded);
    }
    case "UPDATE_SINGLE_NODE": {
      const update = (nodes: WithUIState[]): WithUIState[] =>
        nodes.map((n) => n.id === action.id
          ? { ...n, ...action.data, children: update(n.children) }
          : { ...n, children: update(n.children) });
      return update(state);
    }
    case "UPDATE_MANY_NODES": {
      const update = (nodes: WithUIState[]): WithUIState[] =>
        nodes.map((n) => action.ids.includes(n.id)
          ? { ...n, ...action.data, children: update(n.children) }
          : { ...n, children: update(n.children) });
      return update(state);
    }
    case "SET_NODE_DATA":
      return action.data;
    default:
      return state;
  }
}

const TextbookCuration = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const history = useHistory();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
  const { project: projectData } = useProject(projectID);
  const { activeBatchJob, mutations } = useProjectBatchUpdateJobs(projectID);

  const [bulkActionsOpen, setBulkActionsOpen] = useState<boolean>(false);
  const [showSystemTags, setShowSystemTags] = useState<boolean>(false);
  const [nodeState, dispatch] = useReducer(nodeStateReducer, []);
  const bulkActionsRef = useRef<HTMLDivElement>(null);

  const { control, setValue, watch, getValues } = useForm<FormWorkingData>();
  const { fields, append } = useFieldArray({ control, name: "pages" });

  const hasMadeChanges = useMemo<boolean>(() => {
    const flattened = nodeState.reduce((acc, node) => [...acc, node, ...node.children], [] as WithUIState[]);
    return flattened.some((node) => node.edited);
  }, [nodeState]);

  // Close bulk actions dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bulkActionsRef.current && !bulkActionsRef.current.contains(e.target as Node)) {
        setBulkActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { isFetching } = useQuery<WithUIState[]>({
    queryKey: ["textbook-structure-detailed", projectID],
    queryFn: async () => {
      const res = await api.getBookPagesDetails(
        `${projectData?.libreLibrary}-${projectData?.libreCoverID}`
      );
      if (res.data.err) throw res.data.errMsg;

      const addExpandedState = (nodes: TableOfContentsDetailed[], isRoot = false): WithUIState[] =>
        nodes.map((node) => ({
          ...node,
          expanded: node.children.length === 0,
          loading: false,
          edited: false,
          isRoot,
          children: addExpandedState(node.children),
        }));

      const content = res.data.toc?.children || [];
      const withUIState = addExpandedState(content, true);

      const flatten = (nodes: WithUIState[]): void => {
        nodes.forEach((node) => {
          append({ pageID: node.id, overview: node.overview, tags: node.tags });
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
    enabled: !!projectData?.libreLibrary && !!projectData?.libreCoverID && !activeBatchJob,
  });

  useEffect(() => {
    if (window.localStorage.getItem("conductor_show_coauthor_welcome") === "false") return;
    openModal(<WelcomeToCoAuthorModal onClose={closeAllModals} />);
  }, [window.localStorage]);

  function getPagesToUpdate(workingData: FormWorkingData) {
    const flattened: WithUIState[] = [];
    const flatNodeData = (nodes: WithUIState[]) => {
      nodes.forEach((node) => { flattened.push(node); flatNodeData(node.children); });
    };
    flatNodeData(nodeState);
    const editedNodes = flattened.filter((node) => node.edited);
    const editedPages = workingData.pages.filter((p) => editedNodes?.some((n) => n.id === p.pageID));
    const simplified = editedPages.map((p) => ({ id: p.pageID, summary: p.overview, tags: p.tags }));
    return Array.from(new Set(simplified.map((s) => JSON.stringify(s)))).map((s) => JSON.parse(s));
  }

  async function handleInitSave() {
    const pagesToUpdate = getPagesToUpdate(getValues());
    if (!pagesToUpdate || pagesToUpdate.length === 0) return;
    openModal(
      <BatchUpdateModal projectID={projectID} open={true} pages={pagesToUpdate} onClose={() => closeAllModals()} />
    );
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
      if (res.data.err) throw new Error(res.data.errMsg || "Failed to generate AI summary.");
      if (!res.data.summary) throw new Error("Failed to generate AI summary for this page.");
      const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
      if (fieldIdx === undefined) return;
      setValue(`pages.${fieldIdx}.overview`, res.data.summary);
      success = true;
      addNotification({ type: "success", message: "AI summary generated successfully!" });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      dispatch({ type: "UPDATE_SINGLE_NODE", id: pageID, data: { loading: false, edited: success } });
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
      if (res.data.err) throw new Error(res.data.errMsg || "Failed to generate AI tags.");
      if (!res.data.tags || res.data.tags.length === 0 || res.data.tags.every((t: string) => t === ""))
        throw new Error("Failed to generate AI tags for this page.");
      const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
      if (fieldIdx === undefined) return;
      setValue(`pages.${fieldIdx}.tags`, res.data.tags);
      success = true;
      addNotification({ type: "success", message: "AI tags generated successfully!" });
    } catch (error) {
      console.error(error);
      handleGlobalError(error);
    } finally {
      dispatch({ type: "UPDATE_SINGLE_NODE", id: pageID, data: { loading: false, edited: success } });
    }
  }

  function handleRemoveSingleTag(pageID: string, tag: string) {
    const field = getValues("pages").find((f) => f.pageID === pageID);
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (!field || fieldIdx === undefined) return;
    setValue(`pages.${fieldIdx}.tags`, field.tags.filter((t) => t !== tag));
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
  }

  function handleConfirmRemoveAllOccurrences(tag: string) {
    openModal(
      <ConfirmModal
        text="Are you sure you want to remove this tag from all pages?"
        onConfirm={() => { handleDoRemoveAllOccurrences(tag); closeAllModals(); }}
        onCancel={closeAllModals}
        confirmText="Remove"
        confirmColor="red"
      />
    );
  }

  function handleDoRemoveAllOccurrences(tag: string) {
    const pagesValues = getValues("pages");
    const modified: { pageID: string; overview: string; tags: string[] }[] = [];
    for (let i = 0; i < pagesValues.length; i++) {
      const p = pagesValues[i];
      if (p.tags.includes(tag)) modified.push({ ...p, tags: p.tags.filter((t) => t !== tag) });
    }
    for (let i = 0; i < modified.length; i++) {
      const idx = pagesValues.findIndex((p) => p.pageID === modified[i].pageID);
      if (!idx) continue;
      setValue(`pages.${idx}.tags`, modified[i].tags);
    }
    dispatch({ type: "UPDATE_MANY_NODES", ids: modified.map((m) => m.pageID), data: { edited: true } });
  }

  function handleConfirmReset() {
    openModal(
      <ConfirmModal
        text="Are you sure you want to abort all changes?"
        onConfirm={() => { closeAllModals(); window.location.reload(); }}
        onCancel={closeAllModals}
        confirmText="Reset"
        confirmColor="red"
      />
    );
  }

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
    if (!projectID) return;
    openModal(<ViewBulkUpdateHistoryModal projectID={projectID} onClose={closeAllModals} />);
  };

  const handleOpenBulkAddTagsModal = () => {
    if (!nodeState) return;
    const flatten = (nodes: WithUIState[]): WithUIState[] =>
      nodes.reduce((acc, node) => [...acc, node, ...flatten(node.children)], [] as WithUIState[]);
    const availablePages = flatten(nodeState);
    openModal(
      <BulkAddTagModal
        pages={availablePages.map((p) => ({ id: p.id, title: p.title })) || []}
        onCancel={closeAllModals}
        onConfirm={(pages, tags) => { handleBulkAddTags(pages, tags); closeAllModals(); }}
      />
    );
  };

  const handleBulkAddTags = (pages: string[], tags: string[]) => {
    const pagesValues = getValues("pages");
    tags.forEach((t) => t.trim());
    const modified: { pageID: string; overview: string; tags: string[] }[] = [];
    for (let i = 0; i < pagesValues.length; i++) {
      const p = pagesValues[i];
      if (pages.includes(p.pageID)) modified.push({ ...p, tags: [...p.tags, ...tags] });
    }
    for (let i = 0; i < modified.length; i++) {
      const idx = pagesValues.findIndex((p) => p.pageID === modified[i].pageID);
      if (!idx) continue;
      setValue(`pages.${idx}.tags`, modified[i].tags);
    }
    dispatch({ type: "UPDATE_MANY_NODES", ids: modified.map((m) => m.pageID), data: { edited: true } });
    addNotification({ type: "success", message: "Tags added to selected pages." });
  };

  const handleOpenSingleAddTagModal = (pageID: string) => {
    openModal(
      <SingleAddTagModal
        pageID={pageID}
        onCancel={closeAllModals}
        onConfirm={(pageID, tag) => { handleSingleAddTag(pageID, tag); closeAllModals(); }}
      />
    );
  };

  const handleSingleAddTag = (pageID: string, tag: string) => {
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (fieldIdx === undefined) return;
    const withNew = [...getValues(`pages.${fieldIdx}.tags`), tag.trim()];
    setValue(`pages.${fieldIdx}.tags`, [...new Set(withNew)]);
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
  };

  const handleUpdateSummary = (pageID: string, value: string) => {
    const fieldIdx = getValues("pages").findIndex((f) => f.pageID === pageID);
    if (fieldIdx === undefined) return;
    setValue(`pages.${fieldIdx}.overview`, value);
    dispatch({ type: "SET_EDITED", id: pageID, edited: true });
  };

  const LoadingSkeleton = () => (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-full" />
      ))}
    </div>
  );

  const renderNodes = (nodes: WithUIState[], indentLevel = 1) => {
    if (!projectData?.libreLibrary || !projectData?.libreCoverID) {
      return (
        <p>This project does not have a textbook associated with it. Please return to the main project page to create or connect one.</p>
      );
    }
    return (
      <div key={`tree-node-${indentLevel}`}>
        {nodes.map((node, idx) => {
          const hasChildren = node.children && node.children.length !== 0;
          const fieldIdx = getValues("pages").findIndex((f) => f.pageID === node.id);
          return (
            <Fragment key={`tree-node-${node.id}-${idx}`}>
              {hasChildren && (
                <div
                  className={`flex justify-between items-center border-slate-300 cursor-pointer${node.expanded ? " pr-3" : ""}`}
                  style={{ marginLeft: indentLevel === 1 ? "" : `${indentLevel}rem` }}
                >
                  <div className="flex items-center gap-1">
                    {node.children && node.children.length !== 0 && (
                      node.expanded
                        ? <IconChevronDown size={16} className="cursor-pointer" onClick={(e) => { e.preventDefault(); dispatch({ type: "SET_EXPANDED", id: node.id, expanded: false }); }} />
                        : <IconChevronRight size={16} className="cursor-pointer" onClick={(e) => { e.preventDefault(); dispatch({ type: "SET_EXPANDED", id: node.id, expanded: true }); }} />
                    )}
                    <a href={node.url} target="_blank" rel="noopener noreferrer">{node.title}</a>
                  </div>
                </div>
              )}
              {node.expanded && (
                <>
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
                    onGeneratePageImagesAltText={handleOpenGeneratePageImagesAltTextModal}
                    showSystemTags={showSystemTags}
                  />
                  {node.children && renderNodes(node.children, indentLevel + 1)}
                </>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        AI Co-Author: <em>{projectData?.title}</em>
      </h1>

      <div>
        {/* Breadcrumb + toggle row */}
        <div className="flex flex-row justify-between items-center py-2 border-b">
          <Breadcrumb>
            <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
            <Breadcrumb.Item><Link to={`/projects/${projectID}`}>{projectData?.title || "Loading..."}</Link></Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>AI Co-Author</Breadcrumb.Item>
          </Breadcrumb>
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show System Tags (Admins)</span>
              <Checkbox name="showSystemTags" checked={showSystemTags} onChange={(checked) => setShowSystemTags(checked)} />
            </div>
          )}
        </div>

        {/* Welcome banner */}
        <div className="flex flex-row items-center py-4 border-b">
          <p className="font-semibold max-w-4xl">
            Welcome to LibreTexts' AI Co-Author tool. Here, you can curate AI-generated metadata for your textbook.
            You can generate and edit metadata for individual pages below, or use the bulk actions to generate metadata
            for all pages at once and return here to refine it.
          </p>
          <img
            src="https://cdn.libretexts.net/Images/benny-mascot-white.png"
            alt="Benny the LibreTexts Mascot"
            className="ml-9 h-20 w-20 shrink-0"
          />
        </div>

        {/* Active batch job */}
        {activeBatchJob && (
          <div className="py-3 border-b">
            <ActiveJobAlert
              job={activeBatchJob}
              onRefresh={() => { mutations.refreshActiveJobStatus.mutate(); window.location.reload(); }}
              loading={mutations.refreshActiveJobStatus.isLoading}
            />
          </div>
        )}

        {/* Main content */}
        <div className="py-4">
          {isFetching && (
            <div className="my-16">
              <LoadingSpinner text="Loading content... This may take a moment" />
            </div>
          )}

          <div className="flex flex-row justify-between">
            <div className="flex flex-col max-w-3xl">
              <p className="text-lg">
                <span className="font-semibold">Editing Summaries:</span> Use "Generate Summary" button to generate an AI
                summary for that page. This will replace the current summary with the AI-generated one, which you can then
                edit further.
              </p>
              <p className="text-lg mt-4">
                <span className="font-semibold">Editing Tags:</span> Use the "Generate Tags" to generate new tags for the
                page. You can click the "X" icon to remove a tag from that page, or click the trash icon to remove it from{" "}
                <em>all</em> pages. You can also add individual tags to a page with the plus icon, or use the bulk actions
                to add tags to multiple pages at once.
              </p>
            </div>

            {/* Bulk Actions dropdown */}
            <div className="flex flex-col justify-start" ref={bulkActionsRef}>
              <div className="relative">
                <Button
                  variant="primary"
                  icon={<IconBolt size={14} />}
                  onClick={() => setBulkActionsOpen(!bulkActionsOpen)}
                >
                  Bulk Actions
                </Button>
                {bulkActionsOpen && (
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 w-52">
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => { setBulkActionsOpen(false); history.push(`/projects/${projectID}/ai-co-author/batch`); }}
                      disabled={!!activeBatchJob}
                    >
                      <IconSparkles size={14} /> Generate AI Metadata
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => { setBulkActionsOpen(false); handleOpenBulkAddTagsModal(); }}
                      disabled={!!activeBatchJob}
                    >
                      <IconTags size={14} /> Add Tags
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                      onClick={() => { setBulkActionsOpen(false); handleOpenBulkUpdateHistoryModal(); }}
                    >
                      <IconList size={14} /> View Bulk Update History
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!activeBatchJob && (
            <>
              {/* Top controls bar */}
              <div className="flex flex-row justify-center gap-2 mt-6 border-t border-b border-slate-300 py-4 my-4">
                <Button icon={<IconArrowDown size={14} />} variant="outline" title="Jump to Bottom" onClick={() => handleJumpTo("bottom")} />
                <Button icon={<IconArrowsUpDown size={14} />} variant="outline" title="Expand/Collapse All" onClick={() => dispatch({ type: "EXPAND_COLLAPSE_ALL" })} />
                <Button
                  variant="destructive"
                  icon={<IconRefresh size={14} />}
                  disabled={!hasMadeChanges}
                  title="Reset All Changes"
                  onClick={handleConfirmReset}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  icon={<IconDeviceFloppy size={14} />}
                  disabled={!hasMadeChanges}
                  title="Save Changes"
                  onClick={handleInitSave}
                >
                  Save Changes
                </Button>
              </div>

              {isFetching && <LoadingSkeleton />}
              {nodeState && renderNodes(nodeState)}

              {/* Bottom controls */}
              <div className="flex flex-row justify-center gap-2 mt-6">
                <Button icon={<IconArrowUp size={14} />} variant="outline" title="Jump to Top" onClick={() => handleJumpTo("top")} />
                <Button icon={<IconArrowsUpDown size={14} />} variant="outline" title="Expand/Collapse All" onClick={() => dispatch({ type: "EXPAND_COLLAPSE_ALL" })} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextbookCuration;
