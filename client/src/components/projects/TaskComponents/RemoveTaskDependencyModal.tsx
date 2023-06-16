import { Modal, Breadcrumb, Button, Icon } from "semantic-ui-react";

interface RemoveTaskDepedencyModalProps {
  show: boolean;
  viewTaskData: any;
  rtdLoading: boolean;
  rtdTaskTitle: string;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestRemove: () => void;
  onClose: () => void;
}

const RemoveTaskDepedencyModal: React.FC<RemoveTaskDepedencyModalProps> = ({
  show,
  viewTaskData,
  rtdLoading,
  rtdTaskTitle,
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
              : Remove Dependency
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
              : Remove Dependency
            </Breadcrumb.Section>
          </Breadcrumb>
        )}
      </Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to remove <em>{rtdTaskTitle}</em> as a
          dependency of{" "}
          <em>
            {viewTaskData.hasOwnProperty("title")
              ? viewTaskData.title
              : "Loading..."}
          </em>
          ?
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button loading={rtdLoading} color="red" onClick={onRequestRemove}>
          <Icon name="remove circle" />
          Remove Dependency
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default RemoveTaskDepedencyModal;
