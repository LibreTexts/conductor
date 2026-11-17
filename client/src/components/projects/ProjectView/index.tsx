import "../Projects.css";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Grid, Spinner } from "@libretexts/davis-react";
import lazyWithRetry from "../../../utils/lazyWithRetry";
import { useModals } from "../../../context/ModalContext";
import { useTypedSelector } from "../../../state/hooks";
import useDocumentTitle from "../../../hooks/useDocumentTitle";
import useProject from "../../../hooks/useProject";
import useProjectPermissions from "../../../hooks/useProjectPermissions";
import useProjectTasks from "../../../hooks/useProjectTasks";
import { searchTasks } from "../../../utils/projectTaskHelpers";
import { getFlagGroupName } from "../../util/ProjectHelpers";
import LoadingSpinner from "../../LoadingSpinner";
import ReaderResourcesManager from "../../ReaderResourcesManager/ReaderResourcesManager";
import CoauthorToolsRenamedBanner from "../CoauthorToolsRenamedBanner";
import FlagProjectModal from "../FlagProjectModal";
import ProjectPageHeader from "../ProjectPageHeader";
import RenderProjectModules from "../RenderProjectModules";
import BatchTaskAddModal from "../TaskComponents/BatchTaskAddModal";
import DeleteTaskModal from "../TaskComponents/DeleteTaskModal";
import ManageTaskModal from "../TaskComponents/ManageTaskModal";
import ViewTaskModal from "../TaskComponents/ViewTaskModal";
import { TASK_MODAL_IDS } from "../TaskComponents/modalIds";
import ProjectActionsBar from "./ProjectActionsBar";
import ProjectPropertiesCard from "./ProjectPropertiesCard";
import {
  hasSourceProperties,
  ProjectNotesCard,
  ProjectSourceCard,
  ProjectTeamCard,
} from "./ProjectDetailCards";

const ProjectPropertiesModal = lazyWithRetry(() => import("../ProjectPropertiesModal"));
const ManageTeamModal = lazyWithRetry(() => import("../ManageTeamModal"));

const FLAG_MODAL_ID = "project-flag";
const PAGE_MODAL_IDS = [...Object.values(TASK_MODAL_IDS), FLAG_MODAL_ID];

/** Dialogs that take a `show` prop and must re-render with fresh project data. */
type InlineDialog = "properties" | "team" | "readerResources";

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

  const isFlagged = !!project?.flag;

  return (
    <div className="min-h-screen px-8 pt-8 pb-16">
      <ProjectPageHeader
        projectID={projectID}
        project={project}
        reviewerMode={reviewerMode}
        actions={
          <ProjectActionsBar
            permissions={permissions}
            isFlagged={isFlagged}
            onEditProperties={() => setActiveDialog("properties")}
            onManageTeam={() => setActiveDialog("team")}
            onFlag={openFlag}
          />
        }
      />

      <CoauthorToolsRenamedBanner />

      {showProjectCreated && (
        <Alert variant="success" message="Project successfully created!" className="mb-4" />
      )}
      {project && isFlagged && (
        <Alert
          variant="warning"
          asHeading="p"
          title={`Flagged: ${getFlagGroupName(project.flag)}`}
          message={
            project.flagDescrip
              ? `Reason for flagging: ${project.flagDescrip}`
              : "This flag can be cleared under More Tools."
          }
          className="mb-6"
        />
      )}

      {isLoading || !project ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <ProjectPropertiesCard
            project={project}
            permissions={permissions}
            isMiniRepo={isMiniRepo}
            onOpenReaderResources={() => setActiveDialog("readerResources")}
          />

          <Grid cols={3} gap="md" className="mb-8">
            {project.notes && <ProjectNotesCard notes={project.notes} />}
            {hasSourceProperties(project) && <ProjectSourceCard project={project} />}
            <ProjectTeamCard project={project} />
          </Grid>

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
        </>
      )}
    </div>
  );
};

export default ProjectView;
