import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button as DavisButton,
  EmptyState,
  IconButton,
  Input,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import Messaging from "../Messaging";
import FilesManager from "../FilesManager";
import SkeletonBone from "../SkeletonBone";
import SectionCard from "./ProjectView/SectionCard";
import { DEFAULT_PROJECT_MODULES } from "../../utils/projectHelpers";
import { Project, ProjectTaskAssignee, ProjectTaskView, User } from "../../types";
import { ProjectPermissions } from "../../hooks/useProjectPermissions";
import { TaskSearchResult } from "../../utils/projectTaskHelpers";
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleDashed,
  IconClock,
  IconCopyPlus,
  IconEye,
  IconFilter,
  IconLoader2,
  IconLock,
  IconPlus,
  IconSearch,
  IconSelector,
  IconTrash,
} from "@tabler/icons-react";

interface RenderProjectModulesProps {
  project: Project;
  url: string;
  permissions: ProjectPermissions;
  user: User;
  tasks: (ProjectTaskView & { uiOpen: boolean })[];
  tasksLoading: boolean;
  searchQuery: string;
  searchResults: TaskSearchResult[];
  onSearchChange: (query: string) => void;
  onToggleTask: (taskID: string) => void;
  onToggleAllTasks: () => void;
  onViewTask: (taskID: string) => void;
  onAddTask: () => void;
  onAddSubtask: (parentID: string) => void;
  onDeleteTask: (taskID: string) => void;
  onBatchAddTasks: () => void;
}

const getTeamMemberOptions = (project: Project) =>
  [...project.leads, ...project.liaisons, ...project.members, ...project.auditors].map(
    (item) => ({
      image: `${item.avatar}`,
      value: `${item.firstName} ${item.lastName}`,
      label: `${item.firstName} ${item.lastName}`,
    })
  );

const ModuleToggle = ({
  expanded,
  controls,
  onToggle,
}: {
  expanded: boolean;
  controls?: string;
  onToggle: () => void;
}) => (
  <DavisButton
    variant="ghost"
    size="sm"
    icon={expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
    aria-expanded={expanded}
    aria-controls={controls}
    onClick={onToggle}
  >
    {expanded ? "Hide" : "Show"}
  </DavisButton>
);

const RestrictedState = ({ module }: { module: "Discussion" | "Tasks" }) => (
  <EmptyState
    className="py-10"
    icon={<IconLock size={20} />}
    title={`${module} ${module === "Tasks" ? "are" : "is"} limited to the project team`}
    description={`You don't have permission to view this project's ${module} yet.`}
  />
);

const TASK_STATUS = {
  completed: {
    label: "Completed",
    color: "success",
    icon: <IconCircleCheck size={14} aria-hidden="true" />,
  },
  inprogress: {
    label: "In progress",
    color: "primary",
    icon: <IconLoader2 size={14} aria-hidden="true" />,
  },
  available: {
    label: "Available",
    color: "muted",
    icon: <IconCircleDashed size={14} aria-hidden="true" />,
  },
} as const;

/** Status as icon plus text, never color alone. */
const TaskStatusLabel = ({ status }: { status?: string }) => {
  const meta = TASK_STATUS[status as keyof typeof TASK_STATUS] ?? TASK_STATUS.available;
  return (
    <Text size="sm" color={meta.color} className="inline-flex items-center gap-1 whitespace-nowrap">
      {meta.icon}
      {meta.label}
    </Text>
  );
};

const MAX_VISIBLE_ASSIGNEES = 5;

const AssigneeStack = ({ assignees }: { assignees?: ProjectTaskAssignee[] }) => {
  const valid = (assignees ?? []).filter((a) => a?.uuid && a.firstName && a.lastName);
  if (valid.length === 0) return <span />;
  const overflow = valid.length - MAX_VISIBLE_ASSIGNEES;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-1.5">
        {valid.slice(0, MAX_VISIBLE_ASSIGNEES).map((assignee, idx) => {
          const name = `${assignee.firstName} ${assignee.lastName}`;
          return (
            <Tooltip key={`${assignee.uuid}-${idx}`} content={name}>
              <span className="inline-flex rounded-full ring-2 ring-white">
                <Avatar src={assignee.avatar || undefined} name={name} size="xs" />
              </span>
            </Tooltip>
          );
        })}
      </div>
      {overflow > 0 && (
        <Text size="sm" color="muted" className="whitespace-nowrap">
          + {overflow} more
        </Text>
      )}
    </div>
  );
};

const TASK_ROW_GRID =
  "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[32px_minmax(0,1fr)_auto_auto]";

const TaskListSkeleton = () => (
  <div aria-hidden="true">
    {[
      { title: "w-60", avatars: 3 },
      { title: "w-72", avatars: 2 },
      { title: "w-52", avatars: 1 },
      { title: "w-48", avatars: 0 },
    ].map((row, idx) => (
      <div key={idx} className={`${TASK_ROW_GRID} border-b border-neutral-200 px-4 py-3 last:border-b-0`}>
        <SkeletonBone shape="control" className="mx-auto size-4" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <SkeletonBone className={`h-3 max-w-full ${row.title}`} />
          <SkeletonBone className="h-3 w-20" />
        </div>
        <div className="col-start-2 flex items-center justify-between gap-3 sm:contents">
          <div className="flex -space-x-1.5">
            {Array.from({ length: row.avatars }).map((_, i) => (
              <SkeletonBone key={i} shape="round" className="size-6 ring-2 ring-white" />
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            {[0, 1, 2].map((i) => (
              <SkeletonBone key={i} shape="control" className="size-8" />
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const RenderProjectModules: React.FC<RenderProjectModulesProps> = ({
  project,
  url,
  permissions,
  user,
  tasks: projTasks,
  tasksLoading: loadingTasks,
  searchQuery: taskSearchQuery,
  searchResults: taskSearchResults,
  onSearchChange,
  onToggleTask: toggleTaskDetail,
  onToggleAllTasks: expandCollapseAllTasks,
  onViewTask: openViewTaskModal,
  onAddTask,
  onAddSubtask,
  onDeleteTask: openDeleteTaskModal,
  onBatchAddTasks: openBatchModal,
}) => {
  const projectID = project.projectID;
  const defaultNotificationSetting = project.defaultChatNotification;
  const {
    canViewDetails,
    isAdmin: userProjectAdmin,
    isMember: userProjectMember,
  } = permissions;
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [showFiles, setShowFiles] = useState(true);

  const [selectedValue, setSelectedValue] = useState<string>("");
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);

  const taskAssigneeOptions = useMemo<{ value: string; label: string; image?: string }[]>(
    () => [{ value: "", label: "All assignees" }, ...getTeamMemberOptions(project)],
    [project]
  );

  const selectedAssigneeLabel =
    taskAssigneeOptions.find((option) => option.value === selectedValue)
      ?.label || "All assignees";

  const DiscussionModule = useMemo(() => {
    return (
      <SectionCard
        key="discussion-module"
        title="Discussion"
        actions={
          canViewDetails ? (
            <ModuleToggle
              expanded={showDiscussion}
              controls="project-discussion-body"
              onToggle={() => setShowDiscussion(!showDiscussion)}
            />
          ) : undefined
        }
        bodyClassName="overflow-hidden rounded-b-lg"
      >
        {!canViewDetails ? (
          <RestrictedState module="Discussion" />
        ) : showDiscussion ? (
          <div id="project-discussion-body">
            <Messaging
              projectID={projectID}
              user={user}
              kind="project"
              isProjectAdmin={userProjectAdmin}
              defaultNotificationSetting={defaultNotificationSetting}
              className="sm:h-[440px]"
            />
          </div>
        ) : undefined}
      </SectionCard>
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
            variant="card"
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
          <SectionCard
            title="Assets"
            actions={
              <ModuleToggle
                expanded={false}
                onToggle={() => setShowFiles(!showFiles)}
              />
            }
          />
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
    if (!canViewDetails) {
      return (
        <SectionCard key="tasks-module" title="Tasks">
          <RestrictedState module="Tasks" />
        </SectionCard>
      );
    }

    const timelineURL = `${url}/timeline`;
    // Mobile shows these four as a row of 44px icon-only buttons.
    const toolbarIconClasses = "max-sm:h-11! max-sm:w-full max-sm:px-0!";

    return (
      <SectionCard
        key="tasks-module"
        title="Tasks"
        actions={
          <>
            <DavisButton
              as={Link}
              to={timelineURL}
              variant="ghost"
              size="sm"
              icon={<IconClock size={15} />}
              className="max-sm:hidden"
            >
              Timeline
            </DavisButton>
            <DavisButton
              variant="outline"
              size="sm"
              icon={<IconCopyPlus size={15} />}
              disabled={!userProjectMember}
              onClick={openBatchModal}
              className="max-sm:hidden"
            >
              Batch Add
            </DavisButton>
            <DavisButton
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              disabled={!userProjectMember}
              onClick={onAddTask}
            >
              Add Task
            </DavisButton>
          </>
        }
      >
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[360px] sm:flex-1">
            <Input
              name="task-search"
              label="Search tasks"
              labelClassName="sr-only"
              placeholder="Search tasks..."
              inputClassName="h-10!"
              className="[&>div]:mt-0!"
              value={taskSearchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<IconSearch size={16} />}
            />
            {taskSearchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                {taskSearchResults.map((result: any) => (
                  <button
                    key={result.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-surface-hover"
                    onClick={() => openViewTaskModal(result.id)}
                  >
                    <Text size="sm" weight="medium" className="block">
                      {result.title}
                    </Text>
                    {result.description && (
                      <Text size="sm" color="muted" truncate className="block">
                        {result.description}
                      </Text>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 sm:contents">
            <div
              className="relative sm:min-w-[180px]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setAssigneeFilterOpen(false);
                }
              }}
            >
              <DavisButton
                variant="outline"
                fullWidth
                className="h-10! justify-start max-sm:h-11! max-sm:justify-center max-sm:px-0!"
                icon={
                  selectedValue ? (
                    <Avatar
                      src={
                        taskAssigneeOptions.find((option) => option.value === selectedValue)
                          ?.image
                      }
                      name={selectedAssigneeLabel}
                      size="xs"
                    />
                  ) : (
                    <IconFilter size={16} />
                  )
                }
                iconClassName="items-center justify-center max-sm:mr-0!"
                iconPosition="left"
                onClick={() => setAssigneeFilterOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={assigneeFilterOpen}
              >
                <span className="max-sm:sr-only">
                  {selectedValue ? (
                    selectedAssigneeLabel
                  ) : (
                    <>
                      Filter By...
                      <span className="sr-only"> assignee</span>
                    </>
                  )}
                </span>
                <IconChevronDown size={14} aria-hidden="true" className="ml-auto max-sm:hidden" />
              </DavisButton>
              {assigneeFilterOpen && (
                <div
                  className="absolute left-0 z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
                  role="listbox"
                  aria-label="Filter tasks by assignee"
                >
                  {taskAssigneeOptions.map((option) => (
                    <button
                      key={option.value || "all-assignees"}
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover ${
                        selectedValue === option.value
                          ? "bg-primary-50 font-medium text-primary"
                          : ""
                      }`}
                      role="option"
                      aria-selected={selectedValue === option.value}
                      onClick={() => {
                        setSelectedValue(option.value);
                        setAssigneeFilterOpen(false);
                      }}
                    >
                      <Avatar src={option.image} name={option.label} size="xs" />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DavisButton
              as={Link}
              to={timelineURL}
              variant="outline"
              icon={<IconClock size={16} />}
              iconClassName="mr-0!"
              className={`${toolbarIconClasses} sm:hidden`}
            >
              <span className="sr-only">Timeline</span>
            </DavisButton>
            <span className="hidden sm:block sm:flex-1" aria-hidden="true" />
            <DavisButton
              variant="ghost"
              size="sm"
              icon={<IconSelector size={16} />}
              iconClassName="max-sm:mr-0!"
              className={`${toolbarIconClasses} max-sm:border! max-sm:border-neutral-300!`}
              onClick={expandCollapseAllTasks}
            >
              <span className="max-sm:sr-only">Expand/Collapse All</span>
            </DavisButton>
            <DavisButton
              variant="outline"
              icon={<IconCopyPlus size={16} />}
              iconClassName="mr-0!"
              className={`${toolbarIconClasses} sm:hidden`}
              disabled={!userProjectMember}
              onClick={openBatchModal}
            >
              <span className="sr-only">Batch Add</span>
            </DavisButton>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-lg" aria-busy={loadingTasks || undefined}>
          {loadingTasks ? (
            <>
              <p role="status" className="sr-only">
                Loading tasks…
              </p>
              <TaskListSkeleton />
            </>
          ) : filteredTasks.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {filteredTasks.map((item) => {
                const subtasksID = `task-${item.taskID}-subtasks`;
                return (
                  <li key={item.taskID} className="border-b border-neutral-200 last:border-b-0">
                    <div className={`${TASK_ROW_GRID} px-4 py-3`}>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                        onClick={() => toggleTaskDetail(item.taskID)}
                        aria-expanded={item.uiOpen}
                        aria-controls={subtasksID}
                        aria-label={`Subtasks of ${item.title}`}
                      >
                        {item.uiOpen ? (
                          <IconChevronDown size={16} aria-hidden="true" />
                        ) : (
                          <IconChevronRight size={16} aria-hidden="true" />
                        )}
                      </button>
                      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                        <Text size="sm" weight="semibold">
                          {item.title}
                        </Text>
                        <span className="flex flex-wrap items-center gap-2">
                          <TaskStatusLabel status={item.status} />
                          {item.overdue === true && (
                            <Badge label="OVERDUE" variant="danger" size="sm" />
                          )}
                        </span>
                      </div>
                      <div className="col-start-2 flex items-center justify-between gap-3 sm:contents">
                        <AssigneeStack assignees={item.assignees} />
                        <div className="ml-auto flex items-center gap-1">
                          <IconButton
                            icon={<IconEye size={16} />}
                            aria-label={`View task ${item.title}`}
                            tooltip="View Task"
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewTaskModal(item.taskID)}
                          />
                          <IconButton
                            icon={<IconPlus size={16} />}
                            aria-label={`Add subtask to ${item.title}`}
                            tooltip="Add Subtask"
                            variant="ghost"
                            size="sm"
                            disabled={!userProjectMember}
                            onClick={() => onAddSubtask(item.taskID)}
                          />
                          <IconButton
                            icon={<IconTrash size={16} />}
                            aria-label={`Delete task ${item.title}`}
                            tooltip="Delete Task"
                            variant="ghost"
                            size="sm"
                            className="text-danger-600! hover:bg-danger-50!"
                            disabled={!userProjectMember}
                            onClick={() => openDeleteTaskModal(item.taskID)}
                          />
                        </div>
                      </div>
                    </div>

                    {item.uiOpen && (
                      <div id={subtasksID} className="bg-neutral-50">
                        {Array.isArray(item.subtasks) && item.subtasks.length > 0 ? (
                          <ul className="m-0 list-none p-0">
                            {item.subtasks.map((subtask) => (
                              <li
                                key={subtask.taskID}
                                className={`${TASK_ROW_GRID} border-t border-neutral-200 py-3 pr-4 pl-7`}
                              >
                                <span aria-hidden="true" />
                                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                                  <Text size="sm">{subtask.title}</Text>
                                  <span className="flex flex-wrap items-center gap-2">
                                    <TaskStatusLabel status={subtask.status} />
                                    {subtask.overdue === true && (
                                      <Badge label="OVERDUE" variant="danger" size="sm" />
                                    )}
                                  </span>
                                </div>
                                <div className="col-start-2 flex items-center justify-between gap-3 sm:contents">
                                  <AssigneeStack assignees={subtask.assignees} />
                                  <div className="ml-auto flex items-center gap-1">
                                    <IconButton
                                      icon={<IconEye size={16} />}
                                      aria-label={`View subtask ${subtask.title}`}
                                      tooltip="View Subtask"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openViewTaskModal(subtask.taskID)}
                                    />
                                    <IconButton
                                      icon={<IconTrash size={16} />}
                                      aria-label={`Delete subtask ${subtask.title}`}
                                      tooltip="Delete Subtask"
                                      variant="ghost"
                                      size="sm"
                                      className="text-danger-600! hover:bg-danger-50!"
                                      disabled={!userProjectMember}
                                      onClick={() => openDeleteTaskModal(subtask.taskID)}
                                    />
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <Text
                            as="p"
                            size="sm"
                            color="muted"
                            className="m-0 border-t border-neutral-200 py-3 pr-4 pl-[4.25rem]"
                          >
                            No subtasks yet.
                          </Text>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              className="py-10"
              title={
                selectedValue
                  ? "No matching tasks"
                  : "No tasks yet. Add one to start organizing your work!"
              }
              description={
                selectedValue ? `No tasks assigned to ${selectedAssigneeLabel}.` : undefined
              }
              action={
                !selectedValue && userProjectMember ? (
                  <DavisButton variant="primary" icon={<IconPlus size={15} />} onClick={onAddTask}>
                    Add Task
                  </DavisButton>
                ) : undefined
              }
            />
          )}
        </div>
      </SectionCard>
    );
  }, [
    taskSearchResults,
    taskSearchQuery,
    loadingTasks,
    userProjectMember,
    canViewDetails,
    toggleTaskDetail,
    expandCollapseAllTasks,
    openViewTaskModal,
    openDeleteTaskModal,
    openBatchModal,
    onAddTask,
    onAddSubtask,
    onSearchChange,
    selectedValue,
    filteredTasks,
    taskAssigneeOptions,
    selectedAssigneeLabel,
    assigneeFilterOpen,
    url,
  ]);

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

  const moduleOrder = Object.entries(moduleSettings).map(([key, setting]) => ({
    key: key + "-module",
    order: setting.order,
  }));

  modules.sort((a, b) => {
    return (
      (moduleOrder.find((m) => m.key === a.key)?.order ?? 0) -
      (moduleOrder.find((m) => m.key === b.key)?.order ?? 0)
    );
  });

  return <div className="flex flex-col gap-6">{modules}</div>;
};

export default RenderProjectModules;
