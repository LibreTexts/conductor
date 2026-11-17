import "../Projects.css";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@libretexts/davis-react";
import { IconFlag } from "@tabler/icons-react";
import lazyWithRetry from "../../../utils/lazyWithRetry";
import { useModals } from "../../../context/ModalContext";
import { useTypedSelector } from "../../../state/hooks";
import useDocumentTitle from "../../../hooks/useDocumentTitle";
import useProject from "../../../hooks/useProject";
import useProjectPermissions from "../../../hooks/useProjectPermissions";
import useProjectTasks from "../../../hooks/useProjectTasks";
import { searchTasks } from "../../../utils/projectTaskHelpers";
import { sanitizeMarkdown } from "../../../utils/sanitizeMarkdown";
import { getFlagGroupName } from "../../util/ProjectHelpers";
import LoadingSpinner from "../../LoadingSpinner";
import ReaderResourcesManager from "../../ReaderResourcesManager/ReaderResourcesManager";
import CoauthorToolsRenamedBanner from "../CoauthorToolsRenamedBanner";
import FlagProjectModal from "../FlagProjectModal";
import ProjectPageHeader from "../ProjectPageHeader";
import ProjectLinkButtons from "../ProjectLinkButtons";
import ProjectCoAuthoringToolsButtons, { hasCoAuthoringTools } from "../ProjectCoAuthoringToolsButtons";
import RenderProjectModules from "../RenderProjectModules";
import BatchTaskAddModal from "../TaskComponents/BatchTaskAddModal";
import DeleteTaskModal from "../TaskComponents/DeleteTaskModal";
import ManageTaskModal from "../TaskComponents/ManageTaskModal";
import ViewTaskModal from "../TaskComponents/ViewTaskModal";
import { TASK_MODAL_IDS } from "../TaskComponents/modalIds";
import ProjectActionsBar from "./ProjectActionsBar";
import ProjectPropertiesCard from "./ProjectPropertiesCard";
import ProjectViewSkeleton from "./ProjectViewSkeleton";
import { ProjectNotesCard, ProjectSourceCard, ProjectTeamCard } from "./ProjectDetailCards";
import { hasSourceProperties } from "./projectDisplay";

const ProjectPropertiesModal = lazyWithRetry(() => import("../ProjectPropertiesModal"));
const ManageTeamModal = lazyWithRetry(() => import("../ManageTeamModal"));

const FLAG_MODAL_ID = "project-flag";
const PAGE_MODAL_IDS = [...Object.values(TASK_MODAL_IDS), FLAG_MODAL_ID];

/** Dialogs that take a `show` prop and must re-render with fresh project data. */
type InlineDialog = "properties" | "team" | "readerResources";

const PAGE_CLASSES = "min-h-screen bg-surface-muted px-4 pt-6 pb-16 sm:px-8";
const CONTAINER_CLASSES = "flex flex-col gap-6";

/**
 * Davis Alert only takes a plain-string message, and the flag reason is
 * markdown, so this mirrors the warning Alert's tokens with a rich body.
 */
const FlagNotice = ({ group, description }: { group: string; description?: string }) => {
  const html = useMemo(
    () => (description ? sanitizeMarkdown(description, { breaks: true }) : ""),
    [description]
  );
  return (
    <div className="flex gap-3 rounded-md border border-warning-200 bg-warning-50 p-4 text-sm text-warning-700">
      <IconFlag size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="m-0">
          <strong className="font-semibold">This project has an active flag for {group}.</strong> It can be cleared under
          More tools.
        </p>
        {html && (
          <div className="mt-3 rounded-md border border-warning-200 bg-surface px-4 py-3">
            <p className="m-0 font-semibold">Reason for flagging</p>
            <div
              className="prose prose-code:before:hidden prose-code:after:hidden mt-1 max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectView = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const location = useLocation();
  const history = useHistory();
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModals();
  const user = useTypedSelector((state) => state.user);

  const { project, isLoading, isMiniRepo, useProjectQueryKey } = useProject(projectID);
  const permissions = useProjectPermissions(project, user);
  const { tasks, allTasks, byID, isLoading: tasksLoading, isFetched: tasksFetched } =
    useProjectTasks(projectID, { enabled: permissions.canViewDetails });

  const [activeDialog, setActiveDialog] = useState<InlineDialog | null>(null);
  const [expandedTaskIDs, setExpandedTaskIDs] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const showProjectCreated = searchParams.get("projectCreated") === "true";
  const reviewerMode = searchParams.get("reviewer") === "true";

  useDocumentTitle(
    `LibreTexts Conductor | Projects | ${project?.title || "Project View"}`,
    true
  );

  const refreshProject = useCallback(
    () => queryClient.invalidateQueries(useProjectQueryKey),
    // useProjectQueryKey is rebuilt each render; projectID is its only input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, projectID]
  );

  const openPageModal = useCallback(
    (id: string, render: (close: () => void) => React.ReactNode) => {
      openModal(render(() => closeModal(id)), id);
    },
    [openModal, closeModal]
  );

  const openViewTask = useCallback(
    (taskID: string) =>
      openPageModal(TASK_MODAL_IDS.view, (close) => (
        <ViewTaskModal projectID={projectID} taskID={taskID} onClose={close} />
      )),
    [openPageModal, projectID]
  );

  const openAddTask = useCallback(
    (parentID?: string) =>
      openPageModal(TASK_MODAL_IDS.manage, (close) => (
        <ManageTaskModal projectID={projectID} mode="add" parentID={parentID} onClose={close} />
      )),
    [openPageModal, projectID]
  );

  const openAddRootTask = useCallback(() => openAddTask(), [openAddTask]);

  const openDeleteTask = useCallback(
    (taskID: string) =>
      openPageModal(TASK_MODAL_IDS.delete, (close) => (
        <DeleteTaskModal projectID={projectID} taskID={taskID} onClose={close} />
      )),
    [openPageModal, projectID]
  );

  const openBatchAdd = useCallback(
    () =>
      openPageModal(TASK_MODAL_IDS.batchAdd, (close) => (
        <BatchTaskAddModal projectID={projectID} onClose={close} />
      )),
    [openPageModal, projectID]
  );

  const openFlag = (mode: "set" | "clear") =>
    openPageModal(FLAG_MODAL_ID, (close) => (
      <FlagProjectModal projectID={projectID} mode={mode} onClose={close} />
    ));

  // ModalsProvider lives above the router, so close this page's modals on navigation.
  const closeModalRef = useRef(closeModal);
  closeModalRef.current = closeModal;
  useEffect(() => () => PAGE_MODAL_IDS.forEach((id) => closeModalRef.current(id)), []);

  // Deep link into a task (e.g. from My Tasks): open it once tasks load, then strip the param.
  const openTaskParam = searchParams.get("openTask");
  useEffect(() => {
    if (!openTaskParam || !tasksFetched) return;
    if (byID.has(openTaskParam)) {
      openViewTask(openTaskParam);
    }
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("openTask");
    const nextSearch = nextParams.toString();
    history.replace({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" });
  }, [openTaskParam, tasksFetched, byID, openViewTask, history, location.pathname, location.search]);

  const toggleTask = useCallback((taskID: string) => {
    setExpandedTaskIDs((prev) => {
      const next = new Set(prev);
      if (next.has(taskID)) {
        next.delete(taskID);
      } else {
        next.add(taskID);
      }
      return next;
    });
  }, []);

  const toggleAllTasks = useCallback(() => {
    setExpandedTaskIDs((prev) => (prev.size > 0 ? new Set() : new Set(tasks.map((t) => t.taskID))));
  }, [tasks]);

  const tasksWithUIState = useMemo(
    () => tasks.map((task) => ({ ...task, uiOpen: expandedTaskIDs.has(task.taskID) })),
    [tasks, expandedTaskIDs]
  );
  const searchResults = useMemo(() => searchTasks(allTasks, searchQuery), [allTasks, searchQuery]);

  if (isLoading || !project) {
    return (
      <div className={PAGE_CLASSES}>
        <div className={CONTAINER_CLASSES}>
          <ProjectViewSkeleton />
        </div>
      </div>
    );
  }

  const isFlagged = !!project.flag;
  const isMemberOrAdmin = permissions.isAdmin || permissions.isMember;
  const showCoAuthoringTools = hasCoAuthoringTools({
    isProjectMemberOrAdmin: isMemberOrAdmin,
    libreCoverID: project.libreCoverID,
    libreLibrary: project.libreLibrary,
    projectClassification: project.classification,
  });
  const openReaderResources = () => setActiveDialog("readerResources");

  return (
    <div className={PAGE_CLASSES}>
      <div className={CONTAINER_CLASSES}>
        <ProjectPageHeader
          projectID={projectID}
          project={project}
          reviewerMode={reviewerMode}
          actions={
            <ProjectActionsBar
              projectID={projectID}
              permissions={permissions}
              isFlagged={isFlagged}
              isMiniRepo={isMiniRepo}
              hasAnalytics={!!project.hasTrafficAnalyticsConfigured}
              onEditProperties={() => setActiveDialog("properties")}
              onManageTeam={() => setActiveDialog("team")}
              onFlag={openFlag}
            />
          }
        />

        {/* Directly under the header so both tool cards stay above the fold. */}
        <div className="flex flex-wrap gap-6 empty:hidden">
          <ProjectLinkButtons
            className="min-w-0 flex-[1_1_400px]"
            wide={!showCoAuthoringTools}
            projectID={project.projectID}
            libreCoverID={project.libreCoverID}
            libreLibrary={project.libreLibrary}
            projectLink={project.projectURL}
            projectTitle={project.title}
            adaptCourseID={project.adaptCourseID}
            didCreateWorkbench={project.didCreateWorkbench}
            hasCommonsBook={project.hasCommonsBook}
            projectClassification={project.classification}
            projectVisibility={project.visibility}
            project={project}
            isProjectMemberOrAdmin={isMemberOrAdmin}
            didRequestPublish={project.didRequestPublish}
            showReaderResources={
              permissions.canViewDetails && !!project.hasCommonsBook && !showCoAuthoringTools
            }
            onOpenReaderResources={openReaderResources}
          />
          <ProjectCoAuthoringToolsButtons
            className="min-w-0 flex-[1.5_1_560px]"
            handleOpenReaderResourcesModal={openReaderResources}
            hasCommonsBook={project.hasCommonsBook}
            isProjectMemberOrAdmin={isMemberOrAdmin}
            libreCoverID={project.libreCoverID}
            libreLibrary={project.libreLibrary}
            projectClassification={project.classification}
            projectID={project.projectID}
          />
        </div>

        <div className="flex flex-col gap-4 empty:hidden">
          <CoauthorToolsRenamedBanner />
          {showProjectCreated && (
            <Alert variant="success" message="Project successfully created." />
          )}
          {isFlagged && (
            <FlagNotice group={getFlagGroupName(project.flag)} description={project.flagDescrip} />
          )}
        </div>

        {/* The aside comes first so it leads on mobile; `order` moves it right on desktop. */}
        <div className="flex flex-wrap items-start gap-6">
          <aside
            aria-label="Project details"
            className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 lg:order-2"
          >
            <ProjectPropertiesCard project={project} />
            <ProjectTeamCard project={project} />
            {hasSourceProperties(project) && <ProjectSourceCard project={project} />}
            {project.notes && <ProjectNotesCard notes={project.notes} />}
          </aside>
          <div className="min-w-0 flex-[999_1_640px] lg:order-1">
            <RenderProjectModules
              project={project}
              url={`/projects/${projectID}`}
              permissions={permissions}
              user={user}
              tasks={tasksWithUIState}
              tasksLoading={tasksLoading}
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearchChange={setSearchQuery}
              onToggleTask={toggleTask}
              onToggleAllTasks={toggleAllTasks}
              onViewTask={openViewTask}
              onAddTask={openAddRootTask}
              onAddSubtask={openAddTask}
              onDeleteTask={openDeleteTask}
              onBatchAddTasks={openBatchAdd}
            />
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <ProjectPropertiesModal
          show={activeDialog === "properties"}
          projectID={projectID}
          onClose={() => setActiveDialog(null)}
        />
        <ManageTeamModal
          show={activeDialog === "team"}
          project={project}
          onDataChanged={refreshProject}
          onClose={() => setActiveDialog(null)}
        />
      </Suspense>
      <ReaderResourcesManager
        projectID={project.projectID}
        show={activeDialog === "readerResources"}
        onClose={() => setActiveDialog(null)}
      />
    </div>
  );
};

export default ProjectView;
