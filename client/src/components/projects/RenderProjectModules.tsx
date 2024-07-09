import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Grid,
  Header,
  Icon,
  Image,
  Label,
  List,
  Popup,
  Search,
  Segment,
} from "semantic-ui-react";
import Messaging from "../Messaging";
import FilesManager from "../FilesManager";
import { Link } from "react-router-dom";
import Breakpoint from "../util/Breakpoints";
import { DEFAULT_PROJECT_MODULES } from "../../utils/projectHelpers";

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
}) => {
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [showFiles, setShowFiles] = useState(true);

  const DiscussionModule = useMemo(() => {
    return (
      <Grid.Row key={"discussion-module"}>
        {canViewDetails && showDiscussion && (
          <Grid.Column>
            <Header as="h2" dividing>
              Discussion
              <Button
                compact
                floated="right"
                onClick={() => setShowDiscussion(!showDiscussion)}
              >
                Hide
              </Button>
            </Header>
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
              <Header as="h2" className="project-hiddensection-heading">
                Discussion
              </Header>
              <Button
                floated="right"
                onClick={() => setShowDiscussion(!showDiscussion)}
              >
                Show
              </Button>
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
      <Grid.Row key={"files-module"}>
        {showFiles && (
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
        )}
        {!showFiles && (
          <Grid.Column>
            <Segment raised clearing>
              <Header as="h2" className="project-hiddensection-heading">
                Assets
              </Header>
              <Button floated="right" onClick={() => setShowFiles(!showFiles)}>
                Show
              </Button>
            </Segment>
          </Grid.Column>
        )}
      </Grid.Row>
    );
  }, [projectID, showFiles, canViewDetails, project.defaultFileLicense]);

  const TasksModule = useMemo(() => {
    return (
      <Grid.Row key={"tasks-module"}>
        {canViewDetails && (
          <Grid.Column>
            <Header as="h2" dividing>
              Tasks
            </Header>
            <Segment.Group size="large" raised className="mb-4p">
              <Segment>
                <div className="flex-row-div">
                  <div className="left-flex">
                    <Search
                      input={{
                        icon: "search",
                        iconPosition: "left",
                        placeholder: "Search tasks...",
                      }}
                      loading={taskSearchLoading}
                      onResultSelect={(_e, { result }) =>
                        openViewTaskModal(result.id)
                      }
                      onSearchChange={handleTaskSearch}
                      results={taskSearchResults}
                      value={taskSearchQuery}
                    />
                  </div>
                  <div className="right-flex">
                    <Button.Group fluid>
                      <Button
                        color="olive"
                        as={Link}
                        to={`${url}/timeline`}
                        aria-label="Timeline"
                      >
                        <Icon name="clock outline" />
                        <Breakpoint name="desktop">Timeline</Breakpoint>
                      </Button>
                      <Button
                        color="orange"
                        onClick={expandCollapseAllTasks}
                        aria-label="Expand or Collapse All"
                      >
                        <Icon name="arrows alternate vertical" />
                        <Breakpoint name="desktop">
                          Expand/Collapse All
                        </Breakpoint>
                      </Button>
                      <Button
                        color="purple"
                        disabled={!userProjectMember}
                        onClick={openBatchModal}
                        aria-label="Batch Add"
                      >
                        <Icon name="clone" />
                        <Breakpoint name="desktop">Batch Add</Breakpoint>
                      </Button>
                      <Button
                        color="green"
                        loading={mngTaskLoading}
                        onClick={() => openManageTaskModal("add")}
                        disabled={!userProjectMember}
                        aria-label="Add Task"
                      >
                        <Icon name="add" />
                        <Breakpoint name="desktop">Add Task</Breakpoint>
                      </Button>
                    </Button.Group>
                  </div>
                </div>
              </Segment>
              <Segment
                loading={loadingTasks}
                className={projTasks.length === 0 ? "muted-segment" : ""}
              >
                {projTasks.length > 0 ? (
                  <List divided verticalAlign="middle">
                    {projTasks.map((item: any, idx: any) => {
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
                        <List.Item key={item.taskID}>
                          <div className="flex-col-div">
                            <div className="flex-row-div">
                              <div className="left-flex">
                                <Icon
                                  name={
                                    item.uiOpen
                                      ? "chevron down"
                                      : "chevron right"
                                  }
                                  className="pointer-hover"
                                  onClick={() => toggleTaskDetail(item.taskID)}
                                />
                                <span className="project-task-title">
                                  {item.title}
                                </span>
                                {renderStatusIndicator(item.status)}
                                {item.hasOwnProperty("overdue") &&
                                  item.overdue === true && (
                                    <Label color="red" className="ml-2p">
                                      OVERDUE
                                    </Label>
                                  )}
                              </div>
                              <div className="right-flex">
                                <div className="task-assignees-row">
                                  {item.hasOwnProperty("assignees") &&
                                    item.assignees.length > 0 &&
                                    item.assignees
                                      .slice(0, 5)
                                      .map((assignee: any, assignIdx: any) => {
                                        if (
                                          assignee.uuid &&
                                          assignee.firstName &&
                                          assignee.lastName
                                        ) {
                                          return (
                                            <Popup
                                              key={assignIdx}
                                              trigger={
                                                <Image
                                                  className="cursor-pointer"
                                                  src={
                                                    assignee.avatar ||
                                                    "/mini_logo.png"
                                                  }
                                                  avatar
                                                  key={assignee.uuid}
                                                />
                                              }
                                              header={
                                                <span>
                                                  <strong>{`${assignee.firstName} ${assignee.lastName}`}</strong>
                                                </span>
                                              }
                                              position="top center"
                                            />
                                          );
                                        } else return null;
                                      })}
                                  {item.hasOwnProperty("assignees") &&
                                    item.assignees.length > 5 && (
                                      <p className="muted-text">
                                        {" "}
                                        + {item.assignees.length - 5} more
                                      </p>
                                    )}
                                </div>
                                <Popup
                                  content={
                                    <span className="color-semanticred">
                                      <em>Delete Task</em>
                                    </span>
                                  }
                                  trigger={
                                    <Button
                                      icon="trash"
                                      color="red"
                                      onClick={() =>
                                        openDeleteTaskModal(item.taskID)
                                      }
                                      disabled={!userProjectMember}
                                    />
                                  }
                                  position="top center"
                                />
                                <Popup
                                  content="Add Subtask"
                                  trigger={
                                    <Button
                                      onClick={() =>
                                        openManageTaskModal(
                                          "add",
                                          "",
                                          item.taskID
                                        )
                                      }
                                      icon="add"
                                      color="green"
                                      disabled={!userProjectMember}
                                    />
                                  }
                                  position="top center"
                                />
                                <Popup
                                  content="View Task"
                                  trigger={
                                    <Button
                                      onClick={() =>
                                        openViewTaskModal(item.taskID)
                                      }
                                      icon="eye"
                                      color="blue"
                                    />
                                  }
                                  position="top center"
                                />
                              </div>
                            </div>
                            <div
                              className={
                                item.uiOpen
                                  ? "project-task-detail"
                                  : "project-task-detail hidden"
                              }
                            >
                              <List divided verticalAlign="middle">
                                {item.hasOwnProperty("subtasks") &&
                                item.subtasks.length > 0 ? (
                                  item.subtasks.map((subtask: any) => {
                                    return (
                                      <List.Item
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
                                                <Label
                                                  color="red"
                                                  className="ml-2p"
                                                >
                                                  OVERDUE
                                                </Label>
                                              )}
                                          </div>
                                          <div className="right-flex">
                                            <div className="task-assignees-row">
                                              {subtask.hasOwnProperty(
                                                "assignees"
                                              ) &&
                                                subtask.assignees.length > 0 &&
                                                subtask.assignees
                                                  .slice(0, 5)
                                                  .map(
                                                    (
                                                      assignee: any,
                                                      assignIdx: any
                                                    ) => {
                                                      if (
                                                        assignee.uuid &&
                                                        assignee.firstName &&
                                                        assignee.lastName
                                                      ) {
                                                        return (
                                                          <Popup
                                                            key={assignIdx}
                                                            trigger={
                                                              <Image
                                                                className="cursor-pointer"
                                                                src={
                                                                  assignee.avatar ||
                                                                  "/mini_logo.png"
                                                                }
                                                                avatar
                                                                key={
                                                                  assignee.uuid
                                                                }
                                                              />
                                                            }
                                                            header={
                                                              <span>
                                                                <strong>{`${assignee.firstName} ${assignee.lastName}`}</strong>
                                                              </span>
                                                            }
                                                            position="top center"
                                                          />
                                                        );
                                                      } else return null;
                                                    }
                                                  )}
                                              {subtask.hasOwnProperty(
                                                "assignees"
                                              ) &&
                                                subtask.assignees.length >
                                                  5 && (
                                                  <Popup
                                                    key="more-subtask-assigneed"
                                                    trigger={
                                                      <p className="muted-text">
                                                        {" "}
                                                        +{" "}
                                                        {subtask.assignees
                                                          .length - 5}{" "}
                                                        more
                                                      </p>
                                                    }
                                                    header={
                                                      <span>
                                                        <strong>
                                                          More assignees
                                                        </strong>
                                                      </span>
                                                    }
                                                    position="top center"
                                                  />
                                                )}
                                            </div>
                                            <Popup
                                              content={
                                                <span className="color-semanticred">
                                                  <em>Delete Subtask</em>
                                                </span>
                                              }
                                              trigger={
                                                <Button
                                                  icon="trash"
                                                  color="red"
                                                  onClick={() =>
                                                    openDeleteTaskModal(
                                                      subtask.taskID
                                                    )
                                                  }
                                                  disabled={!userProjectMember}
                                                />
                                              }
                                              position="top center"
                                            />
                                            <Popup
                                              content="View Subtask"
                                              trigger={
                                                <Button
                                                  onClick={() =>
                                                    openViewTaskModal(
                                                      subtask.taskID
                                                    )
                                                  }
                                                  icon="eye"
                                                  color="blue"
                                                />
                                              }
                                              position="top center"
                                            />
                                          </div>
                                        </div>
                                      </List.Item>
                                    );
                                  })
                                ) : (
                                  <List.Item className="project-task-subtask">
                                    <p>
                                      <em>No subtasks yet.</em>
                                    </p>
                                  </List.Item>
                                )}
                              </List>
                            </div>
                          </div>
                        </List.Item>
                      );
                    })}
                  </List>
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
