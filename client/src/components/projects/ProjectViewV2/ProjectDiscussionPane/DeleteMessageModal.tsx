import { Button, Icon, Modal } from "semantic-ui-react";
import useProjectDiscussionThread from "../../../../hooks/projects/useProjectDiscussionThread";

interface DeleteMessageModalProps {
  threadID: string;
  messageID: string;
  onClose: () => void;
}

const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  threadID,
  messageID,
  onClose,
}) => {
  const { deleteMessage } = useProjectDiscussionThread({ id: threadID });
  return (
    <Modal open={true} onClose={onClose}>
      <Modal.Header>Delete Message</Modal.Header>
      <Modal.Content>
        <p>
          {"Are you sure you want to delete this message? "}
          <span className="muted-text">(MessageID: {messageID})</span>
        </p>
        <p>
          <strong>This action is irreversible.</strong>
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="red"
          loading={deleteMessage.isLoading}
          onClick={async () => {
            await deleteMessage.mutateAsync(messageID);
            onClose();
          }}
        >
          <Icon name="trash" />
          Delete Message
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteMessageModal;
