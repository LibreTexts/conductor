import React, { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button as DavisButton,
  Card,
  Divider,
  EmptyState,
  Heading,
  IconButton,
  Input,
  Spinner,
  Stack,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import Messaging from "../Messaging";
import FilesManager from "../FilesManager";
import { useHistory } from "react-router-dom";
import { DEFAULT_PROJECT_MODULES } from "../../utils/projectHelpers";
import {
  IconArrowsDownUp,
  IconCalendarTime,
  IconChevronDown,
  IconChevronRight,
  IconChecklist,
  IconCopyPlus,
  IconEye,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";

interface RenderProjectModulesProps {
  projectID: string;
  project: any;
  url: string;
  canViewDetails: boolean;
  userProjectAdmin: boolean;
  user: any;
  projTasks: any;
  taskSearchLoading: boolean;
  taskSearchResults: any;
  taskSearchQuery: string;
  handleTaskSearch: (e: any, data: any) => void;
  openViewTaskModal: (taskId: string) => void;
  expandCollapseAllTasks: () => void;
  openBatchModal: () => void;
  openManageTaskModal: (
    action: string,
    taskId?: string,
    parentId?: string
  ) => void;
  openDeleteTaskModal: (taskId: string) => void;
  renderStatusIndicator: (status: string) => JSX.Element;
  toggleTaskDetail: (taskId: string) => void;
  userProjectMember: boolean;
  loadingTasks: boolean;
  defaultNotificationSetting?: string;
  mngTaskLoading: boolean;
  libreLibrary?: string;
  libreCoverID?: string;
  getTeamMemberOptions: (
    projData: any
  ) => { value: string; label: string; image?: string }[];
}

const RenderProjectModules: React.FC<RenderProjectModulesProps> = ({
  projectID,
  project,
  url,
  canViewDetails,
  userProjectAdmin,
  user,
  projTasks,
  taskSearchResults,
  taskSearchQuery,
  handleTaskSearch,
  openViewTaskModal,
  expandCollapseAllTasks,
  openBatchModal,
  openManageTaskModal,
  openDeleteTaskModal,
  renderStatusIndicator,
  toggleTaskDetail,
  userProjectMember,
  loadingTasks,
  defaultNotificationSetting,
  mngTaskLoading,
  getTeamMemberOptions,
}) => {
  const history = useHistory();
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [showFiles, setShowFiles] = useState(true);

  const [selectedValue, setSelectedValue] = useState<string>("");
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);

  const taskAssigneeOptions = useMemo(() => {
    if (!project || !Object.keys(project).length) {
      return [{ value: "", label: "All assignees" }];
    }

    return [
      { value: "", label: "All assignees" },
      ...getTeamMemberOptions(project),
    ];
  }, [project, getTeamMemberOptions]);

  const selectedAssigneeLabel =
    taskAssigneeOptions.find((option) => option.value === selectedValue)
      ?.label || "All assignees";

  const renderAssigneeAvatars = (assignees: any[]) => {
    if (!Array.isArray(assignees) || assignees.length === 0) return null;

    return (
      <div className="flex items-center gap-1">
        {assignees.slice(0, 5).map((assignee: any, assignIdx: number) => {
          if (!assignee.uuid || !assignee.firstName || !assignee.lastName) {
            return null;
          }
          const name = `${assignee.firstName} ${assignee.lastName}`;
          return (
            <Tooltip
              key={`${assignee.uuid}-${assignIdx}`}
              content={name}
            >
              <span className="inline-flex">
                <Avatar
                  className="cursor-pointer"
                  src={assignee.avatar || "/mini_logo.png"}
                  name={name}
                  size="sm"
                />
              </span>
            </Tooltip>
          );
        })}
        {assignees.length > 5 && (
          <Text size="xs" color="muted">
            +{assignees.length - 5}
          </Text>
        )}
      </div>
    );
  };

  const DiscussionModule = useMemo(() => {
    return (
      <div key="discussion-module" className="w-full">
        {!canViewDetails ? (
          <Alert
            variant="info"
            title="Discussion"
            message="You don't have permission to view this project's Discussion yet."
          />
        ) : (
          <Card variant="outline" padding="none" className="bg-white">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <Heading level={2} className="m-0! text-lg font-semibold text-slate-900">
                Discussion
              </Heading>
              <DavisButton
                variant="outline"
                size="sm"
                onClick={() => setShowDiscussion(!showDiscussion)}
              >
                {showDiscussion ? "Hide" : "Show"}
              </DavisButton>
            </div>
            {showDiscussion && (
              <>
                <Divider />
                <div className="p-0">
                  <Messaging
                    projectID={projectID}
                    user={user}
                    kind="project"
                    isProjectAdmin={userProjectAdmin}
                    defaultNotificationSetting={defaultNotificationSetting}
                  />
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    );
  }, [
    projectID,
    canViewDetails,
    showDiscussion,
    userProjectAdmin,
    user,
    defaultNotificationSetting,
  ]);

  const FilesModule = useMemo(() => {
    return (
      <div key="files-module" className="w-full">
        {showFiles ? (
          <FilesManager
            key="files-manager"
            projectID={projectID}
            toggleFilesManager={() => setShowFiles(!showFiles)}
            canViewDetails={canViewDetails}
            projectHasDefaultLicense={
              project.defaultFileLicense &&
              Object.keys(project.defaultFileLicense).length > 0
            }
            projectVisibility={project.visibility}
          />
        ) : (
          <Card variant="outline" padding="none" className="bg-white">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <Heading level={2} className="m-0! text-lg font-semibold text-slate-900">
                Assets
              </Heading>
              <DavisButton
                variant="outline"
                size="sm"
                onClick={() => setShowFiles(!showFiles)}
              >
                Show
              </DavisButton>
            </div>
          </Card>
        )}
      </div>
    );
  }, [
    projectID,
    showFiles,
    canViewDetails,
    project.defaultFileLicense,
    project.visibility,
  ]);

  const filteredTasks = useMemo(() => {
    if (!selectedValue) return projTasks;

    return projTasks.filter((task: any) => {
      const taskAssignees = task.assignees || [];
      const subtasks = task.subtasks || [];

      const isAssignedToMainTask = taskAssignees.some(
        (a: { firstName: string; lastName: string }) =>
          `${a.firstName} ${a.lastName}`.toLowerCase() ===
          selectedValue.toLowerCase()
      );

      const isAssignedToSubtask = subtasks.some((subtask: any) => {
        const subtaskAssignees = subtask.assignees || [];
        return subtaskAssignees.some(
          (a: { firstName: string; lastName: string }) =>
            `${a.firstName} ${a.lastName}`.toLowerCase() ===
            selectedValue.toLowerCase()
        );
      });

      return isAssignedToMainTask || isAssignedToSubtask;
    });
  }, [projTasks, selectedValue]);

  const TasksModule = useMemo(() => {
    return (
      <div key="tasks-module" className="w-full">
        {!canViewDetails ? (
          <Alert
            variant="info"
            title="Tasks"
            message="You don't have permission to view this project's Tasks yet."
          />
        ) : (
          <Card variant="outline" padding="none" className="overflow-visible! bg-white">
            {/* Header & Controls */}
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Heading
                    level={2}
                    className="m-0! text-lg font-semibold text-slate-900"
                  >
                    Tasks
                  </Heading>
                  <Badge
                    label={`${filteredTasks.length} ${
                      filteredTasks.length === 1 ? "task" : "tasks"
                    }`}
                    variant="default"
                    size="sm"
                  />
                </div>
              </div>

              <Stack direction="vertical" gap="sm">
                {/* Search + Assignee Filter Row (Pixel-aligned h-10) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="task-search-input relative min-w-[220px] flex-1 max-w-md">
                    <Input
                      name="task-search"
                      label="Search tasks"
                      labelClassName="sr-only"
                      placeholder="Search tasks..."
                      inputClassName="h-10!"
                      value={taskSearchQuery}
                      onChange={(e) =>
                        handleTaskSearch(e, { value: e.target.value })
                      }
                      leftIcon={<IconSearch size={17} />}
                    />
                    {taskSearchResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                        {taskSearchResults.map((result: any) => (
                          <button
                            key={result.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => openViewTaskModal(result.id)}
                          >
                            <span className="block text-sm font-medium text-slate-900">
                              {result.title}
                            </span>
                            {result.description && (
                              <span className="block truncate text-xs text-slate-500">
                                {result.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="relative min-w-[200px] max-w-xs"
                    onBlur={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node
                        )
                      ) {
                        setAssigneeFilterOpen(false);
                      }
                    }}
                  >
                    <DavisButton
                      variant="outline"
                      fullWidth
                      className="h-10! justify-between"
                      icon={
                        selectedValue ? (
                          <Avatar
                            src={
                              taskAssigneeOptions.find(
                                (option) => option.value === selectedValue
                              )?.image
                            }
                            name={selectedAssigneeLabel}
                            size="xs"
                          />
                        ) : (
                          <IconUsers size={16} />
                        )
                      }
                      iconClassName="items-center justify-center"
                      iconPosition="left"
                      onClick={() => setAssigneeFilterOpen((open) => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={assigneeFilterOpen}
                    >
                      {selectedAssigneeLabel}
                    </DavisButton>
                    {assigneeFilterOpen && (
                      <div
                        className="absolute right-0 z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                        role="listbox"
                        aria-label="Filter tasks by assignee"
                      >
                        {taskAssigneeOptions.map((option) => (
                          <button
                            key={option.value || "all-assignees"}
                            type="button"
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                              selectedValue === option.value
                                ? "bg-primary-50 font-medium text-primary"
                                : "text-slate-700"
                            }`}
                            role="option"
                            aria-selected={selectedValue === option.value}
                            onClick={() => {
                              setSelectedValue(option.value);
                              setAssigneeFilterOpen(false);
                            }}
                          >
                            <Avatar
                              src={option.image}
                              name={option.label}
                              size="xs"
                            />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 Action Buttons Row — Icons stay dead-center when text collapses on smaller screens */}
                <div className="grid w-full grid-cols-4 gap-2.5">
                  <DavisButton
                    variant="outline"
                    aria-label="Timeline"
                    onClick={() => history.push(`${url}/timeline`)}
                    icon={<IconCalendarTime size={17} />}
                    iconClassName="items-center justify-center mr-0! lg:mr-2!"
                  >
                    <span className="hidden lg:inline">Timeline</span>
                  </DavisButton>
                  <DavisButton
                    variant="outline"
                    aria-label="Expand or collapse all tasks"
                    onClick={expandCollapseAllTasks}
                    icon={<IconArrowsDownUp size={17} />}
                    iconClassName="items-center justify-center mr-0! lg:mr-2!"
                  >
                    <span className="hidden lg:inline">
                      Expand/Collapse All
                    </span>
                  </DavisButton>
                  <DavisButton
                    variant="outline"
                    aria-label="Batch Add Tasks"
                    disabled={!userProjectMember}
                    onClick={openBatchModal}
                    icon={<IconCopyPlus size={17} />}
                    iconClassName="items-center justify-center mr-0! lg:mr-2!"
                  >
                    <span className="hidden lg:inline">Batch Add</span>
                  </DavisButton>
                  <DavisButton
                    variant="primary"
                    aria-label="Add Task"
                    loading={mngTaskLoading}
                    onClick={() => openManageTaskModal("add")}
                    disabled={!userProjectMember}
                    icon={<IconPlus size={17} />}
                    iconClassName="items-center justify-center mr-0! lg:mr-2!"
                  >
                    <span className="hidden lg:inline">Add Task</span>
                  </DavisButton>
                </div>
              </Stack>
            </div>

            <Divider />

            {/* Task List Body */}
            <div className="px-5 py-2">
              {loadingTasks ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <Spinner size="md" />
                  <Text size="sm" color="muted">
                    Loading tasks...
                  </Text>
                </div>
              ) : filteredTasks.length > 0 ? (
                <ul className="divide-y divide-slate-100 list-none m-0 p-0">
                  {filteredTasks.map((item: any) => {
                    const today = new Date();
                    let overdueTasks = false;
                    if (
                      item.endDateObj &&
                      item.endDateObj instanceof Date &&
                      item.endDateObj <= today &&
                      item.status !== "completed"
                    ) {
                      overdueTasks = true;
                    }
                    if (item.subtasks && Array.isArray(item.subtasks)) {
                      item.subtasks.forEach((subtask: any, sIdx: number) => {
                        if (
                          subtask.endDateObj &&
                          subtask.endDateObj instanceof Date &&
                          subtask.endDateObj <= today &&
                          subtask.status !== "completed"
                        ) {
                          overdueTasks = true;
                          item.subtasks[sIdx].overdue = true;
                        }
                      });
                    }
                    if (overdueTasks) item.overdue = true;

                    return (
                      <li key={item.taskID} className="py-3.5">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-primary"
                                onClick={() => toggleTaskDetail(item.taskID)}
                                aria-label={
                                  item.uiOpen ? "Collapse task" : "Expand task"
                                }
                              >
                                {item.uiOpen ? (
                                  <IconChevronDown size={18} />
                                ) : (
                                  <IconChevronRight size={18} />
                                )}
                              </button>
                              <Text
                                size="base"
                                weight="semibold"
                                className="text-slate-900"
                              >
                                {item.title}
                              </Text>
                              {renderStatusIndicator(item.status)}
                              {item.overdue === true && (
                                <Badge
                                  label="OVERDUE"
                                  variant="danger"
                                  size="sm"
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {renderAssigneeAvatars(item.assignees)}
                              <IconButton
                                icon={<IconTrash size={15} />}
                                iconClassName="items-center justify-center"
                                aria-label="Delete Task"
                                tooltip="Delete Task"
                                variant="destructive"
                                size="sm"
                                disabled={!userProjectMember}
                                onClick={() =>
                                  openDeleteTaskModal(item.taskID)
                                }
                              />
                              <IconButton
                                icon={<IconPlus size={15} />}
                                iconClassName="items-center justify-center"
                                aria-label="Add Subtask"
                                tooltip="Add Subtask"
                                variant="primary"
                                size="sm"
                                disabled={!userProjectMember}
                                onClick={() =>
                                  openManageTaskModal("add", "", item.taskID)
                                }
                              />
                              <IconButton
                                icon={<IconEye size={15} />}
                                iconClassName="items-center justify-center"
                                aria-label="View Task"
                                tooltip="View Task"
                                variant="primary"
                                size="sm"
                                onClick={() => openViewTaskModal(item.taskID)}
                              />
                            </div>
                          </div>

                          {item.uiOpen && (
                            <div className="ml-8 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                              {Array.isArray(item.subtasks) &&
                              item.subtasks.length > 0 ? (
                                <ul className="divide-y divide-slate-200/70 list-none m-0 p-0">
                                  {item.subtasks.map((subtask: any) => (
                                    <li
                                      key={subtask.taskID}
                                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Text
                                          size="sm"
                                          weight="medium"
                                          className="text-slate-800"
                                        >
                                          {subtask.title}
                                        </Text>
                                        {renderStatusIndicator(subtask.status)}
                                        {subtask.overdue === true && (
                                          <Badge
                                            label="OVERDUE"
                                            variant="danger"
                                            size="sm"
                                          />
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {renderAssigneeAvatars(
                                          subtask.assignees
                                        )}
                                        <IconButton
                                          icon={<IconTrash size={15} />}
                                          iconClassName="items-center justify-center"
                                          aria-label="Delete Subtask"
                                          tooltip="Delete Subtask"
                                          variant="destructive"
                                          size="sm"
                                          disabled={!userProjectMember}
                                          onClick={() =>
                                            openDeleteTaskModal(subtask.taskID)
                                          }
                                        />
                                        <IconButton
                                          icon={<IconEye size={15} />}
                                          iconClassName="items-center justify-center"
                                          aria-label="View Subtask"
                                          tooltip="View Subtask"
                                          variant="primary"
                                          size="sm"
                                          onClick={() =>
                                            openViewTaskModal(subtask.taskID)
                                          }
                                        />
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <Text size="xs" color="muted">
                                  No subtasks yet.
                                </Text>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-6">
                  <EmptyState
                    icon={<IconChecklist size={28} />}
                    title={
                      selectedValue
                        ? "No matching tasks"
                        : "No tasks yet"
                    }
                    description={
                      selectedValue
                        ? `No tasks assigned to ${selectedAssigneeLabel}.`
                        : "Create a task above to track project milestones and deadlines."
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }, [
    projTasks,
    taskSearchResults,
    taskSearchQuery,
    loadingTasks,
    userProjectMember,
    mngTaskLoading,
    canViewDetails,
    toggleTaskDetail,
    selectedValue,
    filteredTasks,
    taskAssigneeOptions,
    selectedAssigneeLabel,
    assigneeFilterOpen,
    history,
    url,
  ]);

  const CalculatedModules = useMemo(() => {
    if (!project || !Object.keys(project).length) {
      return (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      );
    }

    const moduleSettings = project.projectModules ?? DEFAULT_PROJECT_MODULES;
    const modules: JSX.Element[] = [];

    if (!moduleSettings || moduleSettings.discussion.enabled) {
      modules.push(DiscussionModule);
    }

    if (!moduleSettings || moduleSettings.files.enabled) {
      modules.push(FilesModule);
    }

    if (!moduleSettings || moduleSettings.tasks.enabled) {
      modules.push(TasksModule);
    }

    const moduleOrder = Object.keys(moduleSettings).map((key) => ({
      key: key + "-module",
      order: moduleSettings[key].order,
    }));

    modules.sort((a, b) => {
      return (
        (moduleOrder.find((m) => m.key === a.key)?.order ?? 0) -
        (moduleOrder.find((m) => m.key === b.key)?.order ?? 0)
      );
    });

    return (
      <Stack direction="vertical" gap="lg">
        {modules}
      </Stack>
    );
  }, [project, DiscussionModule, FilesModule, TasksModule]);

  return CalculatedModules;
};

export default RenderProjectModules;
