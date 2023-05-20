import { Modal, Button, Icon } from "semantic-ui-react";

interface DeleteBlockModalProps {
  show: boolean;
  blockType: "heading" | "textBlock" | "prompt";
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}

const DeleteBlockModal: React.FC<DeleteBlockModalProps> = ({
  show,
  blockType,
  onSave,
  onClose,
  loading,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Delete Block</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete this <strong>{blockType}</strong>{" "}
          block?
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button loading={loading ?? false} color="red" onClick={onSave}>
          <Icon name="trash" />
          Delete Block
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteBlockModal;
