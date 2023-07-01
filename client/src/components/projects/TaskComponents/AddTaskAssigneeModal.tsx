import {
  Modal,
  Breadcrumb,
  Dropdown,
  Button,
  Checkbox,
  Icon,
} from "semantic-ui-react";

interface AddTaskAssigneeModalProps {
  show: boolean;
  viewTaskData: any;
  ataUsers: any[];
  ataLoading: boolean;
  ataError: boolean;
  ataUUID: string;
  ataSubtasks: boolean;
  setATASubtasks: (newVal: boolean) => void;
  setATAUUID: (id: string) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAdd: () => void;
  onClose: () => void;
}

const AddTaskAssigneeModal: React.FC<AddTaskAssigneeModalProps> = ({
  show,
  viewTaskData,
  ataUsers,
  ataLoading,
  ataError,
  ataUUID,
  ataSubtasks,
  setATASubtasks,
  setATAUUID,
  openViewTaskModal,
  getParentTaskName,
  onRequestAdd,
  onClose,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
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
              : Add Assignee
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
              : Add Assignee
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content scrolling className="modal-tall-content">
        <p>
          Select a user to assign to{" "}
          <em>
            {viewTaskData.hasOwnProperty("title")
              ? viewTaskData.title
              : "Loading..."}
          </em>
          .
        </p>
        <Dropdown
          placeholder="Select assignee or start typing to search......"
          search
          fluid
          selection
          loading={ataLoading}
          options={ataUsers}
          error={ataError}
          value={ataUUID}
          onChange={(_e, { value }) => setATAUUID(value?.toString() ?? "")}
          className={
            !viewTaskData.parent || viewTaskData.parent === ""
              ? "mb-2p"
              : "mb-4p"
          }
        />
        {(!viewTaskData.parent || viewTaskData.parent === "") && (
          <Checkbox
            toggle
            checked={ataSubtasks}
            onChange={(_e, data) => setATASubtasks(data.checked ?? false)}
            label="Assign to all subtasks"
            className="mb-2p"
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={ataLoading} onClick={onRequestAdd}>
          <Icon name="add" />
          Add Assignee
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddTaskAssigneeModal;
