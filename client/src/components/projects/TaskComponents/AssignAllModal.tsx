import { Modal, Breadcrumb, Button, Checkbox, Icon } from "semantic-ui-react";

interface AssignAllModalProps {
  show: boolean;
  viewTaskData: any;
  assignAllError: boolean;
  assignAllLoading: boolean;
  assignAllSubtasks: boolean;
  setAssignAllSubtasks: (newVal: boolean) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAssignAll: () => void;
  onClose: () => void;
}

const AssignAllModal: React.FC<AssignAllModalProps> = ({
  show,
  viewTaskData,
  assignAllError,
  assignAllLoading,
  assignAllSubtasks,
  setAssignAllSubtasks,
  openViewTaskModal,
  getParentTaskName,
  onRequestAssignAll,
  onClose,
}) => {
  return (
    <Modal open={show} onClose={onClose} size="small">
      <Modal.Header>
        <Breadcrumb className="task-view-header-crumbs">
          {viewTaskData.parent && viewTaskData.parent !== "" && (
            <>
              <Breadcrumb.Section
                onClick={() => openViewTaskModal(viewTaskData.parent)}
                active
              >
                {getParentTaskName(viewTaskData.parent)}
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
            </>
          )}
          <Breadcrumb.Section active={viewTaskData.parent ? false : true}>
            <em>
              {viewTaskData.hasOwnProperty("title")
                ? viewTaskData.title
                : "Loading..."}
            </em>
            : Assign All Members to Task
          </Breadcrumb.Section>
        </Breadcrumb>
      </Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to assign all members of this project to{" "}
          <em>
            {viewTaskData.hasOwnProperty("title")
              ? viewTaskData.title
              : "Loading..."}
          </em>
          ?
        </p>
        {(!viewTaskData.parent || viewTaskData.parent === "") && (
          <Checkbox
            toggle
            checked={assignAllSubtasks}
            onChange={(_e, data) => setAssignAllSubtasks(data.checked ?? false)}
            label="Assign to all subtasks"
            className="mb-2p"
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={onRequestAssignAll}>
          <Icon name="add" />
          Assign All
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AssignAllModal;
