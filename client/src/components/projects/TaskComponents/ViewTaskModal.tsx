import type { FC, ReactNode } from "react";
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
import DOMPurify from "dompurify";
import { marked } from "marked";
import { User } from "../../../types";
import { fromISODateOnly, toISODateOnly } from "../../../utils/misc";

interface ViewTaskModalProps {
  show: boolean;
  projectID: string;
  user: User;
  viewTaskData: any;
  createTaskOptions: any[];
  viewTaskStatusLoading: boolean;
  viewTaskMsgs: any[];
  viewTaskLoadedMsgs: boolean;
  viewTaskStartDate: Date;
  viewTaskEndDate: Date;
  viewTaskStartDateEdit: boolean;
  viewTaskEndDateEdit: boolean;
  viewTaskStartDateLoading: boolean;
  viewTaskEndDateLoading: boolean;
  viewTaskStartDateNew: Date;
  viewTaskEndDateNew: Date;
  userProjectAdmin: boolean;
  userProjectMember: boolean;
  setViewTaskStartDateNew: (date: Date) => void;
  setViewTaskEndDateNew: (date: Date) => void;
  editTaskDate: (type: string) => void;
  openViewTaskModal: (id: string) => void;
  openDeleteTaskModal: (id: string) => void;
  openATAModal: (id: string) => void;
  openATDModal: () => void;
  openRTDModal: (id: string) => void;
  openRMTAModal: (name: string, uuid: string) => void;
  openAssignAllModal: () => void;
  openManageTaskModal: (
    mode: string,
    taskID: string | null,
    parent: string | null
  ) => void;
  atdLoading: boolean;
  getTaskMessages: () => void;
  getParentTaskName: (id: string) => string;
  submitTaskStatus: (e: any, data: any) => void;
  saveTaskDate: (type: string) => void;
  renderStatusIndicator: (status: string) => JSX.Element;
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
  renderStatusIndicator,
}: {
  title: string;
  status: string;
  overdue?: boolean;
  actions: ReactNode;
  renderStatusIndicator: (status: string) => JSX.Element;
}) => (
  <li className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
    <div className="flex min-w-0 items-center gap-2">
      <span className="project-task-title truncate">{title}</span>
      {renderStatusIndicator(status)}
      {overdue && <Badge label="OVERDUE" variant="danger" size="sm" />}
    </div>
    <div className="flex shrink-0 items-center gap-2">{actions}</div>
  </li>
);

const ViewTaskModal: FC<ViewTaskModalProps> = ({
  show,
  user,
  projectID,
  viewTaskData,
  viewTaskStatusLoading,
  viewTaskMsgs,
  viewTaskLoadedMsgs,
  viewTaskStartDateEdit,
  viewTaskEndDateEdit,
  viewTaskStartDateLoading,
  viewTaskEndDateLoading,
  viewTaskStartDateNew,
  viewTaskEndDateNew,
  createTaskOptions,
  userProjectAdmin,
  userProjectMember,
  setViewTaskStartDateNew,
  setViewTaskEndDateNew,
  editTaskDate,
  openViewTaskModal,
  openDeleteTaskModal,
  openATAModal,
  openATDModal,
  openRTDModal,
  openRMTAModal,
  openManageTaskModal,
  openAssignAllModal,
  atdLoading,
  getTaskMessages,
  getParentTaskName,
  submitTaskStatus,
  saveTaskDate,
  renderStatusIndicator,
  onClose,
}) => {
  const taskTitle = viewTaskData.hasOwnProperty("title")
    ? viewTaskData.title
    : "Loading...";

  const statusOptions = createTaskOptions.map((option) => ({
    value: String(option.value),
    label: String(option.text || option.label || option.value),
  }));

  const parentTitle =
    viewTaskData.parent && viewTaskData.parent !== ""
      ? getParentTaskName(viewTaskData.parent)
      : "";

  const taskPath = parentTitle ? (
    <span className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        className="truncate text-left text-blue-700 hover:underline"
        onClick={() => openViewTaskModal(viewTaskData.parent)}
      >
        {parentTitle}
      </button>
      <span className="text-gray-400">/</span>
      <em className="truncate text-gray-900">{taskTitle}</em>
    </span>
  ) : (
    <em className="truncate text-gray-900">{taskTitle}</em>
  );

  const dependencyInfo = (
    <span className="text-center">
      Tasks that must be completed before{" "}
      <em>{parentTitle ? `${parentTitle} > ${taskTitle}` : taskTitle}</em>.
    </span>
  );

  const blockingInfo = (
    <span className="text-center">
      <em>{parentTitle ? `${parentTitle} > ${taskTitle}` : taskTitle}</em> must
      be completed before these tasks.
    </span>
  );

  return (
    <Modal open={show} onClose={() => onClose()} size="full">
      <Modal.Header className="flex items-center justify-between gap-4">
        <Modal.Title className="min-w-0">{taskPath}</Modal.Title>
        <Modal.Close aria-label="Close task details" />
      </Modal.Header>
      <Modal.Body className="max-h-[80vh] overflow-y-auto p-0">
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
                options={statusOptions}
                value={viewTaskData.status || ""}
                onChange={(e) =>
                  submitTaskStatus(e, {
                    value: e.target.value,
                    name: "status",
                  })
                }
                disabled={!userProjectMember || viewTaskStatusLoading}
              />
            </div>
            <div className="task-detail-div">
              <DetailLabel>Created</DetailLabel>
              <div className="task-detail-textdiv">
                {viewTaskData.createdAtString ? (
                  <p>{viewTaskData.createdAtString}</p>
                ) : (
                  <p>
                    <em>Unknown</em>
                  </p>
                )}
              </div>
            </div>
            <div className="task-detail-div">
              <DetailLabel>Start Date</DetailLabel>
              {!viewTaskStartDateEdit && (
                <div className="task-detail-textdiv">
                  <p className="flex items-center gap-2">
                    {viewTaskData.startDateString ? (
                      viewTaskData.startDateString
                    ) : (
                      <em>Not set</em>
                    )}
                    <TooltipButton
                      label="Edit start date"
                      icon={<IconEdit size={16} />}
                      onClick={() => editTaskDate("start")}
                      disabled={!userProjectMember}
                      variant="outline"
                    />
                  </p>
                </div>
              )}
              {viewTaskStartDateEdit && (
                <div className="mt-3 flex items-end gap-2">
                  <DavisInput
                    name="startDate"
                    type="date"
                    value={toISODateOnly(viewTaskStartDateNew)}
                    label="Start date"
                    labelClassName="sr-only"
                    onChange={(e) => {
                      const parsed = fromISODateOnly(e.target.value);
                      if (!parsed) return;
                      setViewTaskStartDateNew(parsed);
                    }}
                  />
                  <TooltipButton
                    label="Save start date"
                    icon={<IconDeviceFloppy size={16} />}
                    onClick={() => saveTaskDate("start")}
                    loading={viewTaskStartDateLoading}
                  />
                </div>
              )}
            </div>
            <div className="task-detail-div">
              <DetailLabel>End/Due Date</DetailLabel>
              {!viewTaskEndDateEdit && (
                <div className="task-detail-textdiv">
                  <p className="flex items-center gap-2">
                    {viewTaskData.endDateString ? (
                      viewTaskData.endDateObj &&
                      viewTaskData.endDateObj instanceof Date &&
                      viewTaskData.endDateObj <= new Date() &&
                      viewTaskData.status !== "completed" ? (
                        <span className="color-semanticred">
                          {viewTaskData.endDateString}
                        </span>
                      ) : (
                        viewTaskData.endDateString
                      )
                    ) : (
                      <em>Not set</em>
                    )}
                    <TooltipButton
                      label="Edit end date"
                      icon={<IconEdit size={16} />}
                      onClick={() => editTaskDate("end")}
                      disabled={!userProjectMember}
                      variant="outline"
                    />
                  </p>
                </div>
              )}
              {viewTaskEndDateEdit && (
                <div className="mt-3 flex items-end gap-2">
                  <DavisInput
                    name="endDate"
                    type="date"
                    value={toISODateOnly(viewTaskEndDateNew)}
                    label="End date"
                    labelClassName="sr-only"
                    onChange={(e) => {
                      const parsed = fromISODateOnly(e.target.value);
                      if (!parsed) return;
                      setViewTaskEndDateNew(parsed);
                    }}
                  />
                  <TooltipButton
                    label="Save end date"
                    icon={<IconDeviceFloppy size={16} />}
                    onClick={() => saveTaskDate("end")}
                    loading={viewTaskEndDateLoading}
                  />
                </div>
              )}
            </div>
            <div className="task-detail-div">
              <DetailLabel>Assignees</DetailLabel>
              <div className="flex-row-div left-flex gap-2">
                {viewTaskData.hasOwnProperty("assignees") &&
                  viewTaskData.assignees.length > 0 &&
                  viewTaskData.assignees.slice(0, 5).map((item: any) => {
                    const name = `${item.firstName} ${item.lastName}`;
                    return (
                      <Tooltip
                        key={item.uuid}
                        content={
                          <span>
                            <strong>{name}</strong>{" "}
                            <span className="color-semanticred">
                              (click to remove)
                            </span>
                          </span>
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex"
                          onClick={() => openRMTAModal(name, item.uuid)}
                          disabled={!userProjectMember}
                        >
                          <Avatar src={item.avatar} name={name} size="sm" />
                        </button>
                      </Tooltip>
                    );
                  })}
                {viewTaskData.hasOwnProperty("assignees") &&
                  viewTaskData.assignees.length > 5 && (
                    <p className="muted-text">
                      + {viewTaskData.assignees.length - 5} more
                    </p>
                  )}
                <TooltipButton
                  label="Add Assignee"
                  icon={<IconPlus size={16} />}
                  onClick={() => openATAModal(viewTaskData)}
                  disabled={!userProjectMember}
                />
                <TooltipButton
                  label="Assign All Members"
                  icon={<IconUsers size={16} />}
                  onClick={() => openAssignAllModal()}
                  disabled={!userProjectMember}
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
                    openManageTaskModal("edit", viewTaskData.taskID, null)
                  }
                  disabled={!userProjectMember}
                />
                <TooltipButton
                  label="Delete Task"
                  icon={<IconTrash size={16} />}
                  onClick={() => openDeleteTaskModal(viewTaskData.taskID)}
                  disabled={!userProjectMember}
                  variant="destructive"
                />
              </div>
            </div>
          </div>
          <div className="flex-row-div p-6" id="project-task-page">
            <div id="task-view-left">
              {viewTaskData.description && viewTaskData.description !== "" && (
                <div className="mt-1p mb-4p">
                  <SectionHeader title="Description" />
                  <p
                    className="word-break-word prose prose-code:before:hidden prose-code:after:hidden"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        marked(viewTaskData.description)
                      ),
                    }}
                  ></p>
                </div>
              )}
              <div className="mt-2p mb-4p">
                <SectionHeader
                  title="Dependencies"
                  info={dependencyInfo}
                  action={
                    <TooltipButton
                      label="Add dependencies"
                      icon={<IconPlus size={16} />}
                      onClick={openATDModal}
                      loading={atdLoading}
                      disabled={!userProjectMember}
                    />
                  }
                />
                {viewTaskData.dependencies &&
                Array.isArray(viewTaskData.dependencies) &&
                viewTaskData.dependencies.length > 0 ? (
                  <ul className="project-task-list divide-y divide-gray-100">
                    {viewTaskData.dependencies.map((depend: any) => (
                      <TaskListRow
                        key={depend.taskID}
                        title={depend.title}
                        status={depend.status}
                        renderStatusIndicator={renderStatusIndicator}
                        actions={
                          <>
                            <TooltipButton
                              label="Remove as dependency"
                              icon={<IconCircleMinus size={16} />}
                              onClick={() => openRTDModal(depend)}
                              disabled={!userProjectMember}
                              variant="destructive"
                            />
                            <TooltipButton
                              label="View dependency"
                              icon={<IconEye size={16} />}
                              onClick={() => openViewTaskModal(depend.taskID)}
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
              {viewTaskData.blocking &&
                Array.isArray(viewTaskData.blocking) &&
                viewTaskData.blocking.length > 0 && (
                  <div className="mt-4p mb-4p">
                    <SectionHeader title="Blocking" info={blockingInfo} />
                    <ul className="project-task-list divide-y divide-gray-100">
                      {viewTaskData.blocking.map((block: any) => (
                        <TaskListRow
                          key={block.taskID}
                          title={block.title}
                          status={block.status}
                          renderStatusIndicator={renderStatusIndicator}
                          actions={
                            <TooltipButton
                              label="View blocked task"
                              icon={<IconEye size={16} />}
                              onClick={() => openViewTaskModal(block.taskID)}
                            />
                          }
                        />
                      ))}
                    </ul>
                  </div>
                )}
              {(viewTaskData.parent === undefined ||
                viewTaskData.parent === "" ||
                viewTaskData.parent === null) && (
                <div className="mt-4p mb-4p">
                  <SectionHeader
                    title="Subtasks"
                    action={
                      <TooltipButton
                        label="Add subtask"
                        icon={<IconPlus size={16} />}
                        onClick={() =>
                          openManageTaskModal("add", null, viewTaskData.taskID)
                        }
                        disabled={!userProjectMember}
                      />
                    }
                  />
                  {viewTaskData.hasOwnProperty("subtasks") &&
                  viewTaskData.subtasks.length > 0 ? (
                    <ul className="project-task-list divide-y divide-gray-100">
                      {viewTaskData.subtasks.map((subtask: any) => (
                        <TaskListRow
                          key={subtask.taskID}
                          title={subtask.title}
                          status={subtask.status}
                          overdue={subtask.overdue === true}
                          renderStatusIndicator={renderStatusIndicator}
                          actions={
                            <TooltipButton
                              label="View subtask"
                              icon={<IconEye size={16} />}
                              onClick={() => openViewTaskModal(subtask.taskID)}
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
                  activeThread={viewTaskData.taskID}
                  activeThreadTitle={viewTaskData.title}
                  activeThreadMsgs={viewTaskMsgs}
                  loadedThreadMsgs={viewTaskLoadedMsgs}
                  getMessages={getTaskMessages}
                  isProjectAdmin={userProjectAdmin}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ViewTaskModal;
