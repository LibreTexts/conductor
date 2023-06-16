import { Modal, Button, Breadcrumb, Checkbox, Icon } from "semantic-ui-react";

interface RemoveTaskAssigneeModalProps {
  show: boolean;
  viewTaskData: any;
  rmtaName: string;
  rmtaLoading: boolean;
  rmtaSubtasks: boolean;
  setRMTASubtasks: (newVal: boolean) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestRemove: () => void;
  onClose: () => void;
}

const RemoveTaskAssigneeModal: React.FC<RemoveTaskAssigneeModalProps> = ({
  show,
  viewTaskData,
  rmtaName,
  rmtaLoading,
  rmtaSubtasks,
  setRMTASubtasks,
  openViewTaskModal,
  getParentTaskName,
  onRequestRemove,
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
              : Remove Assignee
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
              : Remove Assignee
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to remove <strong>{rmtaName}</strong> as an
          assignee for{" "}
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
            checked={rmtaSubtasks}
            onChange={(_e, data) => setRMTASubtasks(data.checked ?? false)}
            label="Remove from all subtasks"
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button loading={rmtaLoading} color="red" onClick={onRequestRemove}>
          <Icon name="remove circle" />
          Remove Assignee
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default RemoveTaskAssigneeModal;
