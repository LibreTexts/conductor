import {
  Modal,
  Breadcrumb,
  Header,
  Dropdown,
  Button,
  Checkbox,
  Icon,
  Popup,
  List,
  Image,
  Form,
} from "semantic-ui-react";
import Chat from "../../Chat";
import DateInput from "../../DateInput";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { User } from "../../../types";

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
  getTaskMessages: (id: string) => void;
  getParentTaskName: (id: string) => string;
  submitTaskStatus: (e: any, data: any) => void;
  saveTaskDate: (type: string) => void;
  renderStatusIndicator: (status: string) => JSX.Element;
  onClose: () => void;
}

const ViewTaskModal: React.FC<ViewTaskModalProps> = ({
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
  return (
    <Modal open={show} onClose={onClose} size="fullscreen" closeIcon>
      <Modal.Header>
        {viewTaskData.parent && viewTaskData.parent !== "" ? (
          <Breadcrumb className="task-view-header-crumbs">
            <Breadcrumb.Section
              onClick={() => openViewTaskModal(viewTaskData.parent)}
            >
              {getParentTaskName(viewTaskData.parent)}
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>
              <em>
                {viewTaskData.hasOwnProperty("title")
                  ? viewTaskData.title
                  : "Loading..."}
              </em>
            </Breadcrumb.Section>
          </Breadcrumb>
        ) : (
          <Breadcrumb className="task-view-header-crumbs">
            <Breadcrumb.Section active>
              <em>
                {viewTaskData.hasOwnProperty("title")
                  ? viewTaskData.title
                  : "Loading..."}
              </em>
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        <div className="flex-col-div">
          <div className="flex-row-div" id="project-task-header">
            <div className="task-detail-div">
              <Header sub>Status</Header>
              <Dropdown
                className={`compact button ${
                  viewTaskData.status === "completed"
                    ? "green"
                    : viewTaskData.status === "inprogress"
                    ? "blue"
                    : "teal"
                }`}
                placeholder="Status.."
                options={createTaskOptions}
                value={viewTaskData.status}
                loading={viewTaskStatusLoading}
                onChange={submitTaskStatus}
                disabled={!userProjectMember}
              />
            </div>
            <div className="task-detail-div">
              <Header sub>Created</Header>
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
              <Header sub>Start Date</Header>
              {!viewTaskStartDateEdit && (
                <div className="task-detail-textdiv">
                  <p>
                    {viewTaskData.startDateString ? (
                      viewTaskData.startDateString
                    ) : (
                      <em>Not set</em>
                    )}
                    <Icon
                      name="pencil"
                      className={`pl-4p ${
                        userProjectMember && "cursor-pointer"
                      }`}
                      onClick={() => editTaskDate("start")}
                      color="grey"
                      disabled={!userProjectMember}
                    />
                  </p>
                </div>
              )}
              {viewTaskStartDateEdit && (
                <div className="task-detail-textdiv mt-3p">
                  <Form>
                    <Form.Group inline>
                      <Form.Field inline>
                        <DateInput
                          value={viewTaskStartDateNew}
                          className="mt-2p"
                          label=""
                          error={false}
                          onChange={(value) =>
                            setViewTaskStartDateNew(value as Date)
                          }
                        />
                      </Form.Field>
                      <Button
                        icon
                        className="mt-1p"
                        onClick={() => saveTaskDate("start")}
                        color="green"
                        loading={viewTaskStartDateLoading}
                      >
                        <Icon name="save outline" />
                      </Button>
                    </Form.Group>
                  </Form>
                </div>
              )}
            </div>
            <div className="task-detail-div">
              <Header sub>End/Due Date</Header>
              {!viewTaskEndDateEdit && (
                <div className="task-detail-textdiv">
                  <p>
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
                    <Icon
                      name="pencil"
                      className={`pl-4p ${
                        userProjectMember && "cursor-pointer"
                      }`}
                      onClick={() => editTaskDate("end")}
                      color="grey"
                      disabled={!userProjectMember}
                    />
                  </p>
                </div>
              )}
              {viewTaskEndDateEdit && (
                <div className="task-detail-textdiv mt-3p">
                  <Form>
                    <Form.Group inline>
                      <Form.Field inline>
                        <DateInput
                          value={viewTaskEndDateNew}
                          className="mt-2p"
                          label=""
                          error={false}
                          onChange={(value) =>
                            setViewTaskEndDateNew(value as Date)
                          }
                        />
                      </Form.Field>
                      <Button
                        icon
                        className="mt-2p"
                        onClick={() => saveTaskDate("end")}
                        color="green"
                        loading={viewTaskEndDateLoading}
                      >
                        <Icon name="save outline" />
                      </Button>
                    </Form.Group>
                  </Form>
                </div>
              )}
            </div>
            <div className="task-detail-div">
              <Header sub>Assignees</Header>
              <div className="flex-row-div left-flex">
                {viewTaskData.hasOwnProperty("assignees") &&
                  viewTaskData.assignees.length > 0 &&
                  viewTaskData.assignees.slice(0, 5).map((item: any, idx: number) => {
                    return (
                      <Popup
                        key={idx}
                        trigger={
                          <Image
                            className="cursor-pointer"
                            src={item.avatar}
                            avatar
                            key={item.uuid}
                            onClick={() => {
                              openRMTAModal(
                                `${item.firstName} ${item.lastName}`,
                                item.uuid
                              );
                            }}
                          />
                        }
                        header={
                          <span>
                            <strong>{`${item.firstName} ${item.lastName}`}</strong>{" "}
                            <span className="color-semanticred">
                              (click to remove)
                            </span>
                          </span>
                        }
                        position="top center"
                      />
                    );
                  })}
                  {
                    (viewTaskData.hasOwnProperty('assignees') && viewTaskData.assignees.length > 5) && (
                      <p className='muted-text'> + {viewTaskData.assignees.length - 5} more</p>
                    )
                  }
                <Popup
                  key="add-assignee"
                  trigger={
                    <Button
                      size="tiny"
                      circular
                      icon="add"
                      color="green"
                      onClick={() => openATAModal(viewTaskData)}
                      disabled={!userProjectMember}
                    />
                  }
                  header={
                    <span>
                      <em>Add Assignee</em>
                    </span>
                  }
                  position="top center"
                />
                <Popup
                  key="assign-all"
                  trigger={
                    <Button
                      size="tiny"
                      circular
                      icon="users"
                      color="blue"
                      onClick={() => openAssignAllModal()}
                      disabled={!userProjectMember}
                    />
                  }
                  header={
                    <span>
                      <em>Assign All Members</em>
                    </span>
                  }
                  position="top center"
                />
              </div>
            </div>
            <div className="task-actions-div">
              <Header sub>Actions</Header>
              <div className="flex-row-div left-flex">
                <Popup
                  key="edit-task"
                  trigger={
                    <Button
                      size="tiny"
                      icon="pencil"
                      color="blue"
                      onClick={() =>
                        openManageTaskModal("edit", viewTaskData.taskID, null)
                      }
                      disabled={!userProjectMember}
                    />
                  }
                  header={
                    <span>
                      <em>Edit Task</em>
                    </span>
                  }
                  position="top center"
                />
                <Popup
                  key="delete-task"
                  trigger={
                    <Button
                      size="tiny"
                      icon="trash"
                      color="red"
                      onClick={() => openDeleteTaskModal(viewTaskData.taskID)}
                      disabled={!userProjectMember}
                    />
                  }
                  header={
                    <span className="color-semanticred">
                      <em>Delete Task</em>
                    </span>
                  }
                  position="top center"
                />
              </div>
            </div>
          </div>
          <div className="flex-row-div" id="project-task-page">
            <div id="task-view-left">
              {viewTaskData.description && viewTaskData.description !== "" && (
                <div className="mt-1p mb-4p">
                  <Header as="h3" dividing>
                    Description
                  </Header>
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
                <div className="dividing-header-custom">
                  <h3>Dependencies</h3>
                  <Popup
                    trigger={<Icon className="ml-05p" name="info circle" />}
                    position="top center"
                    content={
                      <span className="text-center">
                        Tasks that must be completed before{" "}
                        <em>
                          {viewTaskData.parent && viewTaskData.parent !== ""
                            ? `${getParentTaskName(viewTaskData.parent)} > ${
                                viewTaskData.hasOwnProperty("title")
                                  ? viewTaskData.title
                                  : "Loading..."
                              }`
                            : `${
                                viewTaskData.hasOwnProperty("title")
                                  ? viewTaskData.title
                                  : "Loading..."
                              }`}
                        </em>
                        .
                      </span>
                    }
                  />
                  <div className="right-flex">
                    <Popup
                      position="top center"
                      trigger={
                        <Button
                          color="green"
                          icon
                          onClick={openATDModal}
                          loading={atdLoading}
                          disabled={!userProjectMember}
                        >
                          <Icon name="add" />
                        </Button>
                      }
                      content="Add dependencies"
                    />
                  </div>
                </div>
                {viewTaskData.dependencies &&
                Array.isArray(viewTaskData.dependencies) &&
                viewTaskData.dependencies.length > 0 ? (
                  <List
                    divided
                    verticalAlign="middle"
                    className="project-task-list"
                  >
                    {viewTaskData.dependencies.map((depend: any) => {
                      return (
                        <List.Item
                          className="project-task-subtask"
                          key={depend.taskID}
                        >
                          <div className="flex-row-div">
                            <div className="left-flex">
                              <span className="project-task-title">
                                {depend.title}
                              </span>
                              {renderStatusIndicator(depend.status)}
                            </div>
                            <div className="right-flex">
                              <Popup
                                content="Remove as dependency"
                                trigger={
                                  <Button
                                    onClick={() => openRTDModal(depend)}
                                    icon="remove circle"
                                    color="red"
                                    disabled={!userProjectMember}
                                  />
                                }
                                position="top center"
                              />
                              <Popup
                                content="View dependency"
                                trigger={
                                  <Button
                                    onClick={() =>
                                      openViewTaskModal(depend.taskID)
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
                    })}
                  </List>
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
                    <div className="dividing-header-custom">
                      <h3>Blocking</h3>
                      <Popup
                        trigger={<Icon className="ml-05p" name="info circle" />}
                        position="top center"
                        content={
                          <span className="text-center">
                            <em>
                              {viewTaskData.parent && viewTaskData.parent !== ""
                                ? `${getParentTaskName(
                                    viewTaskData.parent
                                  )} > ${
                                    viewTaskData.hasOwnProperty("title")
                                      ? viewTaskData.title
                                      : "Loading..."
                                  }`
                                : `${
                                    viewTaskData.hasOwnProperty("title")
                                      ? viewTaskData.title
                                      : "Loading..."
                                  }`}
                            </em>{" "}
                            must be completed before these tasks.
                          </span>
                        }
                      />
                    </div>
                    <List
                      divided
                      verticalAlign="middle"
                      className="project-task-list"
                    >
                      {viewTaskData.blocking.map((block: any) => {
                        return (
                          <List.Item
                            className="project-task-subtask"
                            key={block.taskID}
                          >
                            <div className="flex-row-div">
                              <div className="left-flex">
                                <span className="project-task-title">
                                  {block.title}
                                </span>
                                {renderStatusIndicator(block.status)}
                              </div>
                              <div className="right-flex">
                                <Popup
                                  content="View blocked task"
                                  trigger={
                                    <Button
                                      onClick={() =>
                                        openViewTaskModal(block.taskID)
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
                      })}
                    </List>
                  </div>
                )}
              {(viewTaskData.parent === undefined ||
                viewTaskData.parent === "" ||
                viewTaskData.parent === null) && (
                <div className="mt-4p mb-4p">
                  <div className="dividing-header-custom">
                    <h3>Subtasks</h3>
                    <div className="right-flex">
                      <Popup
                        position="top center"
                        trigger={
                          <Button
                            color="green"
                            icon
                            onClick={() =>
                              openManageTaskModal(
                                "add",
                                null,
                                viewTaskData.taskID
                              )
                            }
                            disabled={!userProjectMember}
                          >
                            <Icon name="add" />
                          </Button>
                        }
                        content="Add subtask"
                      />
                    </div>
                  </div>
                  {viewTaskData.hasOwnProperty("subtasks") &&
                  viewTaskData.subtasks.length > 0 ? (
                    <List
                      divided
                      verticalAlign="middle"
                      className="project-task-list"
                    >
                      {viewTaskData.subtasks.map((subtask: any) => {
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
                                {renderStatusIndicator(subtask.status)}
                              </div>
                              <div className="right-flex">
                                <Popup
                                  content="View subtask"
                                  trigger={
                                    <Button
                                      onClick={() =>
                                        openViewTaskModal(subtask.taskID)
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
                      })}
                    </List>
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
      </Modal.Content>
    </Modal>
  );
};

export default ViewTaskModal;
