import { Button, Icon, Modal } from "semantic-ui-react";
import useProjectDiscussions from "../../../../hooks/projects/useProjectDiscussions";

interface DeleteThreadModal {
  projectID: string;
  threadID: string;
  onClose: () => void;
}

const DeleteThreadModal: React.FC<DeleteThreadModal> = ({
  projectID,
  threadID,
  onClose,
}) => {
  const { deleteThread } = useProjectDiscussions({ id: projectID });

  return (
    <Modal open={true} onClose={onClose}>
      <Modal.Header>Delete Thread</Modal.Header>
      <Modal.Content>
        <p>Are you sure you want to delete this thread?</p>
        <p>
          <strong>
            This will delete all messages within the thread. This action is
            irreversible.
          </strong>
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="red"
          loading={deleteThread.isLoading}
          onClick={async () => {
            await deleteThread.mutateAsync({ threadID });
            onClose();
          }}
        >
          <Icon name="trash" />
          Delete Thread
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteThreadModal;
