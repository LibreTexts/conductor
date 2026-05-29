import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button as DavisButton,
  Input,
  Tooltip,
} from "@libretexts/davis-react";
import {
  Grid,
  Header,
  Segment,
} from "semantic-ui-react";
import Messaging from "../Messaging";
import FilesManager from "../FilesManager";
import { useHistory } from "react-router-dom";
import Breakpoint from "../util/Breakpoints";
import { DEFAULT_PROJECT_MODULES } from "../../utils/projectHelpers";
import { useTypedSelector } from "../../state/hooks";
import {
  IconCalendarTime,
  IconArrowsDownUp,
  IconChevronDown,
  IconChevronRight,
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
  getTeamMemberOptions: (projData: any) => { value: string; label: string; image?: string }[];
}

const RenderProjectModules: React.FC<RenderProjectModulesProps> = ({
  projectID,
  project,
  url,
  canViewDetails,
  userProjectAdmin,
  user,
  projTasks,
  taskSearchLoading,
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
  libreLibrary,
  libreCoverID,
  getTeamMemberOptions
}) => {
  const history = useHistory();
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [showFiles, setShowFiles] = useState(true);

  const [selectedValue, setSelectedValue] = useState<string>('');
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);

  const taskAssigneeOptions = useMemo(
    () => {
      if (!project || !Object.keys(project).length) {
        return [{ value: "", label: "All assignees" }];
      }

      return [
        { value: "", label: "All assignees" },
        ...getTeamMemberOptions(project),
      ];
    },
    [project, getTeamMemberOptions]
  );

  const selectedAssigneeLabel = taskAssigneeOptions.find(
    (option) => option.value === selectedValue
  )?.label || "Filter by...";

  const renderAssigneeAvatars = (assignees: any[]) => {
    if (!Array.isArray(assignees) || assignees.length === 0) return null;

    return (
      <>
        {assignees.slice(0, 5).map((assignee: any, assignIdx: number) => {
          if (!assignee.uuid || !assignee.firstName || !assignee.lastName) {
            return null;
          }
          const name = `${assignee.firstName} ${assignee.lastName}`;
          return (
            <Tooltip key={`${assignee.uuid}-${assignIdx}`} content={<strong>{name}</strong>}>
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
          <span className="muted-text">+ {assignees.length - 5} more</span>
        )}
      </>
    );
  };

  const renderTaskActionButton = ({
    label,
    icon,
    onClick,
    disabled,
    className,
    variant = "primary",
  }: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    disabled?: boolean;
    className: string;
    variant?: "primary" | "outline" | "destructive";
  }) => (
    <Tooltip content={label}>
      <span className="ml-2 inline-flex">
        <DavisButton
          variant={variant}
          size="sm"
          aria-label={label}
          icon={icon}
          onClick={onClick}
          disabled={disabled}
          className={className}
        />
      </span>
    </Tooltip>
  );

  const DiscussionModule = useMemo(() => {
    return (
      <Grid.Row key={"discussion-module"}>
        {canViewDetails && showDiscussion && (
          <Grid.Column>
            <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
              <Header as="h2" style={{ margin: 0 }}>Discussion</Header>
              <DavisButton
                variant="outline"
                size="sm"
                onClick={() => setShowDiscussion(!showDiscussion)}
              >
                Hide
              </DavisButton>
            </div>
            <Segment
              size="large"
              raised
              className="project-discussion-segment mb-2p"
            >
              <Messaging
                projectID={projectID}
                user={user}
                kind="project"
                isProjectAdmin={userProjectAdmin}
                defaultNotificationSetting={defaultNotificationSetting}
              />
            </Segment>
          </Grid.Column>
        )}
        {canViewDetails && !showDiscussion && (
          <Grid.Column>
            <Segment raised clearing>
              <div className="flex items-center justify-between">
                <Header as="h2" className="project-hiddensection-heading" style={{ margin: 0 }}>
                  Discussion
                </Header>
                <DavisButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiscussion(!showDiscussion)}
                >
                  Show
                </DavisButton>
              </div>
            </Segment>
          </Grid.Column>
        )}
        {!canViewDetails && (
          <Grid.Column>
            <Header as="h2" dividing>
              Discussion
            </Header>
            <Segment size="large" raised className="mb-2p">
              <p>
                <em>
                  You don't have permission to view this project's Discussion
                  yet.
                </em>
              </p>
            </Segment>
          </Grid.Column>
        )}
      </Grid.Row>
    );
  }, [projectID, canViewDetails, showDiscussion, userProjectAdmin]);

  const FilesModule = useMemo(() => {
    return (
      <Grid.Row key={"files-module"} className="!mt-6">
        {showFiles && (
          <Grid.Column className="!w-full">
            <FilesManager
              key={"files-manager"}
              projectID={projectID}
              toggleFilesManager={() => setShowFiles(!showFiles)}
              canViewDetails={canViewDetails}
              projectHasDefaultLicense={
                project.defaultFileLicense &&
                Object.keys(project.defaultFileLicense).length > 0
              }
              projectVisibility={project.visibility}
            />
          </Grid.Column>
        )}
        {!showFiles && (
          <Grid.Column>
            <Segment raised clearing>
              <div className="flex items-center justify-between">
                <Header as="h2" className="project-hiddensection-heading" style={{ margin: 0 }}>
                  Assets
                </Header>
                <DavisButton variant="outline" size="sm" onClick={() => setShowFiles(!showFiles)}>
                  Show
                </DavisButton>
              </div>
            </Segment>
          </Grid.Column>
        )}
      </Grid.Row>
    );
  }, [projectID, showFiles, canViewDetails, project.defaultFileLicense]);

  const filteredTasks = useMemo(() => {
    if (!selectedValue) return projTasks;

    return projTasks.filter((task: any) => {
      const taskAssignees = task.assignees || [];
      const subtasks = task.subtasks || [];
      
      const isAssignedToMainTask = taskAssignees.some(
        (a: { firstName: string; lastName: string }) => 
          `${a.firstName} ${a.lastName}`.toLowerCase() === selectedValue.toLowerCase()
      );
  
      const isAssignedToSubtask = subtasks.some((subtask: any) => {
        const subtaskAssignees = subtask.assignees || [];
        return subtaskAssignees.some(
          (a: { firstName: string; lastName: string }) =>
            `${a.firstName} ${a.lastName}`.toLowerCase() === selectedValue.toLowerCase()
        );
      });
  
      return isAssignedToMainTask || isAssignedToSubtask;
    });
  }, [projTasks, selectedValue]);

  const TasksModule = useMemo(() => {
    return (
      <Grid.Row key={"tasks-module"} className="!mt-8">
        {canViewDetails && (
          <Grid.Column>
            <Header as="h2" dividing>
              Tasks
            </Header>
            <Segment.Group size="large" raised className="mb-4p">
              <Segment>
                <div className="flex-col-div" style={{ gap: '1rem' }}>
                  <div className="flex-row-div" style={{ 
                    flexWrap: 'wrap', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    <div style={{ 
                      flex: '1 1 auto', 
                      minWidth: '200px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      width: '100%'
                    }}>
                      <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Input
                          name="task-search"
                          label="Search tasks"
                          labelClassName="sr-only"
                          placeholder="Search tasks..."
                          value={taskSearchQuery}
                          onChange={(e) =>
                            handleTaskSearch(e, { value: e.target.value })
                          }
                          leftIcon={<IconSearch size={18} />}
                        />
                        {taskSearchResults.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                            {taskSearchResults.map((result: any) => (
                              <button
                                key={result.id}
                                type="button"
                                className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                                onClick={() => openViewTaskModal(result.id)}
                              >
                                <span className="block font-medium">
                                  {result.title}
                                </span>
                                {result.description && (
                                  <span className="block truncate text-sm text-gray-500">
                                    {result.description}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        className="relative min-w-[220px] max-w-sm"
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                            setAssigneeFilterOpen(false);
                          }
                        }}
                      >
                        <DavisButton
                          variant="outline"
                          fullWidth
                          className="justify-between"
                          icon={
                            selectedValue ? (
                              <Avatar
                                src={taskAssigneeOptions.find((option) => option.value === selectedValue)?.image}
                                name={selectedAssigneeLabel}
                                size="xs"
                              />
                            ) : (
                              <IconUsers size={16} />
                            )
                          }
                          iconPosition="left"
                          onClick={() => setAssigneeFilterOpen((open) => !open)}
                          aria-haspopup="listbox"
                          aria-expanded={assigneeFilterOpen}
                        >
                          {selectedAssigneeLabel}
                        </DavisButton>
                        {assigneeFilterOpen && (
                          <div
                            className="absolute right-0 z-50 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                            role="listbox"
                            aria-label="Filter tasks by assignee"
                          >
                            {taskAssigneeOptions.map((option) => (
                              <button
                                key={option.value || "all-assignees"}
                                type="button"
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
                                  selectedValue === option.value ? "bg-blue-50 text-blue-700" : ""
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
                    </div>
                  </div>
                  <div className="right-flex">
                    <div className="grid w-full grid-cols-4 gap-3">
                      <DavisButton
                        variant="outline"
                        onClick={() => history.push(`${url}/timeline`)}
                        icon={<IconCalendarTime size={16} />}
                      >
                        <Breakpoint name="desktop">Timeline</Breakpoint>
                      </DavisButton>
                      <DavisButton
                        variant="outline"
                        onClick={expandCollapseAllTasks}
                        icon={<IconArrowsDownUp size={16} />}
                      >
                        <Breakpoint name="desktop">
                          Expand/Collapse All
                        </Breakpoint>
                      </DavisButton>
                      <DavisButton
                        variant="outline"
                        disabled={!userProjectMember}
                        onClick={openBatchModal}
                        icon={<IconCopyPlus size={16} />}
                      >
                        <Breakpoint name="desktop">Batch Add</Breakpoint>
                      </DavisButton>
                      <DavisButton
                        variant="primary"
                        loading={mngTaskLoading}
                        onClick={() => openManageTaskModal("add")}
                        disabled={!userProjectMember}
                        icon={<IconPlus size={16} />}
                      >
                        <Breakpoint name="desktop">Add Task</Breakpoint>
                      </DavisButton>
                    </div>
                  </div>
                </div>
              </Segment>
              <Segment
                loading={loadingTasks}
                className={projTasks.length === 0 ? "muted-segment" : ""}
              >
                {projTasks.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {filteredTasks.map((item: any, idx: any) => {
                      let today = new Date();
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
                        item.subtasks.forEach((subtask: any, idx: any) => {
                          if (
                            subtask.endDateObj &&
                            subtask.endDateObj instanceof Date &&
                            subtask.endDateObj <= today &&
                            subtask.status !== "completed"
                          ) {
                            overdueTasks = true;
                            item.subtasks[idx].overdue = true;
                          }
                        });
                      }
                      if (overdueTasks) item.overdue = true;
                      return (
                        <li key={item.taskID} className="py-4">
                          <div className="flex-col-div">
                            <div className="flex-row-div">
                              <div className="left-flex">
                                <button
                                  type="button"
                                  className="inline-flex text-gray-800 hover:text-blue-700"
                                  onClick={() => toggleTaskDetail(item.taskID)}
                                  aria-label={
                                    item.uiOpen ? "Collapse task" : "Expand task"
                                  }
                                >
                                  {item.uiOpen ? (
                                    <IconChevronDown size={20} />
                                  ) : (
                                    <IconChevronRight size={20} />
                                  )}
                                </button>
                                <span className="project-task-title">
                                  {item.title}
                                </span>
                                {renderStatusIndicator(item.status)}
                                {item.hasOwnProperty("overdue") &&
                                  item.overdue === true && (
                                    <Badge label="OVERDUE" variant="danger" size="sm" className="ml-2p" />
                                  )}
                              </div>
                              <div className="right-flex">
                                <div className="task-assignees-row">
                                  {renderAssigneeAvatars(item.assignees)}
                                </div>
                                {renderTaskActionButton({
                                  label: "Delete Task",
                                  icon: <IconTrash size={16} />,
                                  onClick: () => openDeleteTaskModal(item.taskID),
                                  disabled: !userProjectMember,
                                  className: "",
                                  variant: "destructive",
                                })}
                                {renderTaskActionButton({
                                  label: "Add Subtask",
                                  icon: <IconPlus size={16} />,
                                  onClick: () =>
                                    openManageTaskModal("add", "", item.taskID),
                                  disabled: !userProjectMember,
                                  className: "",
                                })}
                                {renderTaskActionButton({
                                  label: "View Task",
                                  icon: <IconEye size={16} />,
                                  onClick: () => openViewTaskModal(item.taskID),
                                  className: "",
                                })}
                              </div>
                            </div>
                            <div
                              className={
                                item.uiOpen
                                  ? "project-task-detail"
                                  : "project-task-detail hidden"
                              }
                            >
                              <ul className="divide-y divide-gray-100">
                                {item.hasOwnProperty("subtasks") &&
                                item.subtasks.length > 0 ? (
                                  item.subtasks.map((subtask: any) => {
                                    return (
                                      <li
                                        className="project-task-subtask"
                                        key={subtask.taskID}
                                      >
                                        <div className="flex-row-div">
                                          <div className="left-flex">
                                            <span className="project-task-title">
                                              {subtask.title}
                                            </span>
                                            {renderStatusIndicator(
                                              subtask.status
                                            )}
                                            {subtask.hasOwnProperty(
                                              "overdue"
                                            ) &&
                                              subtask.overdue === true && (
                                                <Badge label="OVERDUE" variant="danger" size="sm" className="ml-2p" />
                                              )}
                                          </div>
                                          <div className="right-flex">
                                            <div className="task-assignees-row">
                                              {renderAssigneeAvatars(subtask.assignees)}
                                            </div>
                                            {renderTaskActionButton({
                                              label: "Delete Subtask",
                                              icon: <IconTrash size={16} />,
                                              onClick: () =>
                                                openDeleteTaskModal(subtask.taskID),
                                              disabled: !userProjectMember,
                                              className: "",
                                              variant: "destructive",
                                            })}
                                            {renderTaskActionButton({
                                              label: "View Subtask",
                                              icon: <IconEye size={16} />,
                                              onClick: () =>
                                                openViewTaskModal(subtask.taskID),
                                              className: "",
                                            })}
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  })
                                ) : (
                                  <li className="project-task-subtask">
                                    <p>
                                      <em>No subtasks yet.</em>
                                    </p>
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div>
                    <p className="text-center muted-text">
                      <em>No tasks yet. Add one above!</em>
                    </p>
                  </div>
                )}
              </Segment>
            </Segment.Group>
          </Grid.Column>
        )}
        {!canViewDetails && (
          <Grid.Column>
            <Header as="h2" dividing>
              Tasks
            </Header>
            <Segment size="large" raised className="mb-2p">
              <p>
                <em>
                  You don't have permission to view this project's Tasks yet.
                </em>
              </p>
            </Segment>
          </Grid.Column>
        )}
      </Grid.Row>
    );
  }, [
    projTasks,
    taskSearchLoading,
    taskSearchResults,
    taskSearchQuery,
    loadingTasks,
    userProjectMember,
    userProjectAdmin,
    mngTaskLoading,
    canViewDetails,
    toggleTaskDetail,
    selectedValue,          
    filteredTasks,
    taskAssigneeOptions,
    selectedAssigneeLabel,
    assigneeFilterOpen,
    history
  ]);

  const CalculatedModules = useMemo(() => {
    if (!project || !Object.keys(project).length) {
      // project not loaded yet
      return <p>Loading...</p>;
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

    const moduleOrder = Object.keys(moduleSettings).map((key) => {
      return { key: key + "-module", order: moduleSettings[key].order };
    });

    modules.sort((a, b) => {
      return (
        moduleOrder.find((m) => m.key === a.key)?.order -
        moduleOrder.find((m) => m.key === b.key)?.order
      );
    });

    return <>{modules}</>;
  }, [projectID, project, DiscussionModule, FilesModule, TasksModule]);

  return CalculatedModules;
};

export default RenderProjectModules;
