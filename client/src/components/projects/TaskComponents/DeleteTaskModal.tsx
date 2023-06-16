import React from "react";
import { Modal, Breadcrumb, Button, Icon } from "semantic-ui-react";

interface DeleteTaskModalProps {
  show: boolean;
  delTaskSubtask: boolean;
  delTaskParent: string;
  delTaskData: any;
  delTaskHasSubtasks: boolean;
  delTaskLoading: boolean;
  getParentTaskName: (id: string) => string;
  onRequestDelete: () => void;
  onClose: () => void;
}
const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  show,
  delTaskSubtask,
  delTaskParent,
  delTaskData,
  delTaskHasSubtasks,
  delTaskLoading,
  getParentTaskName,
  onRequestDelete,
  onClose,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>
        {delTaskSubtask && delTaskParent !== "" ? (
          <Breadcrumb className="task-view-header-crumbs">
            <Breadcrumb.Section>
              <em>{getParentTaskName(delTaskParent)}</em>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>
              Delete <em>{delTaskData.title || "Loading..."}</em>
            </Breadcrumb.Section>
          </Breadcrumb>
        ) : (
          <Breadcrumb className="task-view-header-crumbs">
            <Breadcrumb.Section active>
              Delete <em>{delTaskData.title || "Loading..."}</em>
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete the{" "}
          <strong>{delTaskData.title}</strong>{" "}
          <span className="muted-text">(ID: {delTaskData.taskID})</span> task?
        </p>
        {delTaskHasSubtasks && (
          <p className="text-center">
            <strong>All subtasks will also be deleted!</strong>
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="red" loading={delTaskLoading} onClick={onRequestDelete}>
          <Icon name="trash" />
          Delete
          {delTaskSubtask ? " Subtask" : " Task"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};
export default DeleteTaskModal;
