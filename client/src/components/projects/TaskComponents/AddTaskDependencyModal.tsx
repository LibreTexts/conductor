import { Modal, Breadcrumb, Button, Dropdown, Icon } from "semantic-ui-react";

interface AddTaskDependencyModalProps {
  show: boolean;
  viewTaskData: any;
  atdTasks: any[];
  atdLoading: boolean;
  atdError: boolean;
  atdTaskID: string;
  setATDTaskID: (id: string) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAdd: () => void;
  onClose: () => void;
}
const AddTaskDependencyModal: React.FC<AddTaskDependencyModalProps> = ({
  show,
  viewTaskData,
  atdTasks,
  atdLoading,
  atdError,
  atdTaskID,
  setATDTaskID,
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
              : Add Dependency
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
              : Add Dependency
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content scrolling className="modal-tall-content">
        <p>
          Select a task to add as a dependency for{" "}
          <em>
            {viewTaskData.hasOwnProperty("title")
              ? viewTaskData.title
              : "Loading..."}
          </em>
          .
        </p>
        <Dropdown
          placeholder="Select task or start typing to search..."
          search
          fluid
          selection
          loading={atdLoading}
          options={atdTasks}
          error={atdError}
          value={atdTaskID}
          onChange={(_e, { value }) => setATDTaskID(value?.toString() ?? "")}
          className="mb-4p"
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={atdLoading} onClick={onRequestAdd}>
          <Icon name="add" /> Add Dependency
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddTaskDependencyModal;
