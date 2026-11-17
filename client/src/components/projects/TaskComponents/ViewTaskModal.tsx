import { useState, type FC, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Input as DavisInput,
  Modal,
  Select,
  Tooltip,
} from "@libretexts/davis-react";
import {
  IconCircleMinus,
  IconDeviceFloppy,
  IconEdit,
  IconEye,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import Chat from "../../Chat";
import { useModals } from "../../../context/ModalContext";
import { useTypedSelector } from "../../../state/hooks";
import useProject from "../../../hooks/useProject";
import useProjectPermissions from "../../../hooks/useProjectPermissions";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import useTaskMessages from "../../../hooks/useTaskMessages";
import { fromISODateOnly, toISODateOnly } from "../../../utils/misc";
import { sanitizeMarkdown } from "../../../utils/sanitizeMarkdown";
import { formatTaskDate, TASK_STATUS_OPTIONS } from "../../../utils/projectTaskHelpers";
import { ProjectTaskRef, TaskStatus } from "../../../types";
import TaskStatusBadge from "./TaskStatusBadge";
import AddTaskAssigneeModal from "./AddTaskAssigneeModal";
import AddTaskDependencyModal from "./AddTaskDependencyModal";
import AssignAllModal from "./AssignAllModal";
import DeleteTaskModal from "./DeleteTaskModal";
import ManageTaskModal from "./ManageTaskModal";
import RemoveTaskAssigneeModal from "./RemoveTaskAssigneeModal";
import RemoveTaskDependencyModal from "./RemoveTaskDependencyModal";
import { TASK_MODAL_IDS } from "./modalIds";

interface ViewTaskModalProps {
  projectID: string;
  taskID: string;
  onClose: () => void;
}

const DetailLabel = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-800">
    {children}
  </div>
);

const SectionHeader = ({
  title,
  info,
  action,
}: {
  title: string;
  info?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
    <h3 className="m-0 text-xl font-semibold text-gray-900">{title}</h3>
    {info && (
      <Tooltip content={info}>
        <span className="inline-flex text-gray-600">
          <IconInfoCircle size={18} />
        </span>
      </Tooltip>
    )}
    {action && <div className="ml-auto">{action}</div>}
  </div>
);

const TooltipButton = ({
  label,
  icon,
  onClick,
  disabled,
  loading,
  variant = "primary",
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "destructive";
  className?: string;
}) => (
  <Tooltip content={label}>
    <span className="inline-flex">
      <Button
        variant={variant}
        size="sm"
        icon={icon}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        className={className}
      />
    </span>
  </Tooltip>
);

const TaskListRow = ({
  title,
  status,
  overdue,
  actions,
}: {
  title: string;
  status: string;
  overdue?: boolean;
  actions: ReactNode;
}) => (
  <li className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
    <div className="flex min-w-0 items-center gap-2">
      <span className="project-task-title truncate">{title}</span>
      <TaskStatusBadge status={status} />
      {overdue && <Badge label="OVERDUE" variant="danger" size="sm" />}
    </div>
    <div className="flex shrink-0 items-center gap-2">{actions}</div>
  </li>
);

const ViewTaskModal: FC<ViewTaskModalProps> = ({ projectID, taskID, onClose }) => {
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeModal } = useModals();
  const { project } = useProject(projectID);
  const { isAdmin, isMember } = useProjectPermissions(project, user);
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { updateTask } = useProjectTaskMutations(projectID);

  // Navigating to a parent, subtask, or dependency swaps the task shown in place.
  const [activeTaskID, setActiveTaskID] = useState(taskID);
  const [startDateDraft, setStartDateDraft] = useState<Date | null>(null);
  const [endDateDraft, setEndDateDraft] = useState<Date | null>(null);

  const { messages, isFetched: messagesFetched, refetch: refetchMessages } =
    useTaskMessages(activeTaskID);

  const task = byID.get(activeTaskID);
  const taskTitle = task?.title ?? "Loading...";
  const parentTitle = task?.parent ? getTaskTitle(task.parent) : "";
  const fullTitle = parentTitle ? `${parentTitle} > ${taskTitle}` : taskTitle;

  const pendingUpdate = updateTask.isLoading ? updateTask.variables : undefined;
  const savingStatus = pendingUpdate?.status !== undefined;
  const savingStartDate = pendingUpdate?.startDate !== undefined;
  const savingEndDate = pendingUpdate?.endDate !== undefined;

  const showTask = (id: string) => {
    setActiveTaskID(id);
    setStartDateDraft(null);
    setEndDateDraft(null);
  };

  const openChild = (id: string, render: (close: () => void) => ReactNode) => {
    const close = () => closeModal(id);
    openModal(render(close), id);
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ projectID, taskID: activeTaskID, status });
  };

  const saveDate = (field: "startDate" | "endDate", value: Date | null) => {
    if (!value) return;
    const formatted = formatTaskDate(value);
    const clearDraft = field === "startDate" ? setStartDateDraft : setEndDateDraft;
    updateTask.mutate(
      field === "startDate"
        ? { taskID: activeTaskID, startDate: formatted }
        : { taskID: activeTaskID, endDate: formatted },
      { onSuccess: () => clearDraft(null) }
    );
  };

  const endDateIsPast =
    !!task?.endDateObj && task.endDateObj <= new Date() && task.status !== "completed";

  const taskPath = parentTitle ? (
    <span className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        className="truncate text-left text-blue-700 hover:underline"
        onClick={() => task?.parent && showTask(task.parent)}
      >
        {parentTitle}
      </button>
      <span aria-hidden="true" className="text-gray-400">/</span>
      <em className="truncate text-gray-900">{taskTitle}</em>
    </span>
  ) : (
    <em className="truncate text-gray-900">{taskTitle}</em>
  );

  return (
    <Modal open onClose={() => onClose()} size="full">
      <Modal.Header className="flex items-center justify-between gap-4">
        <Modal.Title className="min-w-0">{taskPath}</Modal.Title>
        <Modal.Close aria-label="Close task details" />
      </Modal.Header>
      <Modal.Body className="max-h-[80vh] overflow-y-auto p-0">
        {task && (
          <div className="flex-col-div" id="task-view-content">
            <div
              className="grid gap-6 border-b border-gray-200 p-6 md:grid-cols-3 xl:grid-cols-6"
              id="project-task-header"
            >
              <div className="task-detail-div">
                <DetailLabel>Status</DetailLabel>
                <Select
                  name="task-status"
                  label="Status"
                  labelClassName="sr-only"
                  placeholder="Status..."
                  options={TASK_STATUS_OPTIONS}
                  value={task.status || ""}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  disabled={!isMember || savingStatus}
                />
              </div>
              <div className="task-detail-div">
                <DetailLabel>Created</DetailLabel>
                <div className="task-detail-textdiv">
                  <p>{task.createdAtString ?? <em>Unknown</em>}</p>
                </div>
              </div>
              <div className="task-detail-div">
                <DetailLabel>Start Date</DetailLabel>
                {startDateDraft === null ? (
                  <div className="task-detail-textdiv">
                    <p className="flex items-center gap-2">
                      {task.startDateString ?? <em>Not set</em>}
                      <TooltipButton
                        label="Edit start date"
                        icon={<IconEdit size={16} />}
                        onClick={() => setStartDateDraft(task.startDateObj ?? new Date())}
                        disabled={!isMember}
                        variant="outline"
                      />
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-end gap-2">
                    <DavisInput
                      name="startDate"
                      type="date"
                      value={toISODateOnly(startDateDraft)}
                      label="Start date"
                      labelClassName="sr-only"
                      onChange={(e) => {
                        const parsed = fromISODateOnly(e.target.value);
                        if (parsed) setStartDateDraft(parsed);
                      }}
                    />
                    <TooltipButton
                      label="Save start date"
                      icon={<IconDeviceFloppy size={16} />}
                      onClick={() => saveDate("startDate", startDateDraft)}
                      loading={savingStartDate}
                    />
                  </div>
                )}
              </div>
              <div className="task-detail-div">
                <DetailLabel>End/Due Date</DetailLabel>
                {endDateDraft === null ? (
                  <div className="task-detail-textdiv">
                    <p className="flex items-center gap-2">
                      {task.endDateString ? (
                        <span className={endDateIsPast ? "color-semanticred" : undefined}>
                          {task.endDateString}
                        </span>
                      ) : (
                        <em>Not set</em>
                      )}
                      <TooltipButton
                        label="Edit end date"
                        icon={<IconEdit size={16} />}
                        onClick={() => setEndDateDraft(task.endDateObj ?? new Date())}
                        disabled={!isMember}
                        variant="outline"
                      />
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-end gap-2">
                    <DavisInput
                      name="endDate"
                      type="date"
                      value={toISODateOnly(endDateDraft)}
                      label="End date"
                      labelClassName="sr-only"
                      onChange={(e) => {
                        const parsed = fromISODateOnly(e.target.value);
                        if (parsed) setEndDateDraft(parsed);
                      }}
                    />
                    <TooltipButton
                      label="Save end date"
                      icon={<IconDeviceFloppy size={16} />}
                      onClick={() => saveDate("endDate", endDateDraft)}
                      loading={savingEndDate}
                    />
                  </div>
                )}
              </div>
              <div className="task-detail-div">
                <DetailLabel>Assignees</DetailLabel>
                <div className="flex-row-div left-flex gap-2">
                  {task.assignees.slice(0, 5).map((item) => {
                    const name = `${item.firstName} ${item.lastName}`;
                    return (
                      <Tooltip
                        key={item.uuid}
                        content={
                          <span>
                            <strong>{name}</strong>{" "}
                            <span className="color-semanticred">(click to remove)</span>
                          </span>
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex"
                          aria-label={`Remove ${name} as assignee`}
                          onClick={() =>
                            openChild(TASK_MODAL_IDS.removeAssignee, (close) => (
                              <RemoveTaskAssigneeModal
                                projectID={projectID}
                                taskID={activeTaskID}
                                assignee={{ uuid: item.uuid, name }}
                                onClose={close}
                              />
                            ))
                          }
                          disabled={!isMember}
                        >
                          <Avatar src={item.avatar} name={name} size="sm" />
                        </button>
                      </Tooltip>
                    );
                  })}
                  {task.assignees.length > 5 && (
                    <p className="muted-text">+ {task.assignees.length - 5} more</p>
                  )}
                  <TooltipButton
                    label="Add Assignee"
                    icon={<IconPlus size={16} />}
                    onClick={() =>
                      openChild(TASK_MODAL_IDS.addAssignee, (close) => (
                        <AddTaskAssigneeModal
                          projectID={projectID}
                          taskID={activeTaskID}
                          onClose={close}
                        />
                      ))
                    }
                    disabled={!isMember}
                  />
                  <TooltipButton
                    label="Assign All Members"
                    icon={<IconUsers size={16} />}
                    onClick={() =>
                      openChild(TASK_MODAL_IDS.assignAll, (close) => (
                        <AssignAllModal
                          projectID={projectID}
                          taskID={activeTaskID}
                          onClose={close}
                          onAssigned={onClose}
                        />
                      ))
                    }
                    disabled={!isMember}
                  />
                </div>
              </div>
              <div className="task-detail-div">
                <DetailLabel>Actions</DetailLabel>
                <div className="task-detail-textdiv gap-4">
                  <TooltipButton
                    label="Edit Task"
                    icon={<IconEdit size={16} />}
                    onClick={() =>
                      openChild(TASK_MODAL_IDS.manage, (close) => (
                        <ManageTaskModal
                          projectID={projectID}
                          mode="edit"
                          taskID={activeTaskID}
                          onClose={close}
                        />
                      ))
                    }
                    disabled={!isMember}
                  />
                  <TooltipButton
                    label="Delete Task"
                    icon={<IconTrash size={16} />}
                    onClick={() =>
                      openChild(TASK_MODAL_IDS.delete, (close) => (
                        <DeleteTaskModal
                          projectID={projectID}
                          taskID={activeTaskID}
                          onClose={close}
                          onDeleted={onClose}
                        />
                      ))
                    }
                    disabled={!isMember}
                    variant="destructive"
                  />
                </div>
              </div>
            </div>
            <div className="flex-row-div p-6" id="project-task-page">
              <div id="task-view-left">
                {task.description && (
                  <div className="mt-1p mb-4p">
                    <SectionHeader title="Description" />
                    <div
                      className="word-break-word prose prose-code:before:hidden prose-code:after:hidden"
                      dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(task.description) }}
                    />
                  </div>
                )}
                <div className="mt-2p mb-4p">
                  <SectionHeader
                    title="Dependencies"
                    info={
                      <span className="text-center">
                        Tasks that must be completed before <em>{fullTitle}</em>.
                      </span>
                    }
                    action={
                      <TooltipButton
                        label="Add dependencies"
                        icon={<IconPlus size={16} />}
                        onClick={() =>
                          openChild(TASK_MODAL_IDS.addDependency, (close) => (
                            <AddTaskDependencyModal
                              projectID={projectID}
                              taskID={activeTaskID}
                              onClose={close}
                            />
                          ))
                        }
                        disabled={!isMember}
                      />
                    }
                  />
                  {task.dependencies.length > 0 ? (
                    <ul className="project-task-list divide-y divide-gray-100">
                      {task.dependencies
                        .filter((dep): dep is ProjectTaskRef => typeof dep === "object" && !!dep)
                        .map((depend) => (
                          <TaskListRow
                            key={depend.taskID}
                            title={depend.title}
                            status={depend.status}
                            actions={
                              <>
                                <TooltipButton
                                  label="Remove as dependency"
                                  icon={<IconCircleMinus size={16} />}
                                  onClick={() =>
                                    openChild(TASK_MODAL_IDS.removeDependency, (close) => (
                                      <RemoveTaskDependencyModal
                                        projectID={projectID}
                                        taskID={activeTaskID}
                                        dependency={depend}
                                        onClose={close}
                                      />
                                    ))
                                  }
                                  disabled={!isMember}
                                  variant="destructive"
                                />
                                <TooltipButton
                                  label="View dependency"
                                  icon={<IconEye size={16} />}
                                  onClick={() => showTask(depend.taskID)}
                                />
                              </>
                            }
                          />
                        ))}
                    </ul>
                  ) : (
                    <p className="text-center muted-text mt-2p">
                      <em>No dependencies yet. Add one above!</em>
                    </p>
                  )}
                </div>
                {task.blocking && task.blocking.length > 0 && (
                  <div className="mt-4p mb-4p">
                    <SectionHeader
                      title="Blocking"
                      info={
                        <span className="text-center">
                          <em>{fullTitle}</em> must be completed before these tasks.
                        </span>
                      }
                    />
                    <ul className="project-task-list divide-y divide-gray-100">
                      {task.blocking.map((block) => (
                        <TaskListRow
                          key={block.taskID}
                          title={block.title}
                          status={block.status}
                          actions={
                            <TooltipButton
                              label="View blocked task"
                              icon={<IconEye size={16} />}
                              onClick={() => showTask(block.taskID)}
                            />
                          }
                        />
                      ))}
                    </ul>
                  </div>
                )}
                {!task.parent && (
                  <div className="mt-4p mb-4p">
                    <SectionHeader
                      title="Subtasks"
                      action={
                        <TooltipButton
                          label="Add subtask"
                          icon={<IconPlus size={16} />}
                          onClick={() =>
                            openChild(TASK_MODAL_IDS.manage, (close) => (
                              <ManageTaskModal
                                projectID={projectID}
                                mode="add"
                                parentID={activeTaskID}
                                onClose={close}
                              />
                            ))
                          }
                          disabled={!isMember}
                        />
                      }
                    />
                    {task.subtasks && task.subtasks.length > 0 ? (
                      <ul className="project-task-list divide-y divide-gray-100">
                        {task.subtasks.map((subtask) => (
                          <TaskListRow
                            key={subtask.taskID}
                            title={subtask.title}
                            status={subtask.status}
                            overdue={subtask.overdue}
                            actions={
                              <TooltipButton
                                label="View subtask"
                                icon={<IconEye size={16} />}
                                onClick={() => showTask(subtask.taskID)}
                              />
                            }
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center muted-text mt-2p">
                        <em>No subtasks yet. Add one above!</em>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div id="task-view-right">
                <div id="task-view-chat">
                  <Chat
                    projectID={projectID}
                    user={user}
                    mode="standalone"
                    kind="task"
                    activeThread={activeTaskID}
                    activeThreadTitle={taskTitle}
                    activeThreadMsgs={messages}
                    loadedThreadMsgs={messagesFetched}
                    getMessages={() => refetchMessages()}
                    isProjectAdmin={isAdmin}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ViewTaskModal;
