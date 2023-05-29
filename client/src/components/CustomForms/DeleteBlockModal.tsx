import { Modal, Button, Icon, ModalProps } from "semantic-ui-react";

interface DeleteBlockModalProps extends ModalProps {
  show: boolean;
  blockType: "heading" | "textBlock" | "prompt";
  onSave: () => void;
  onRequestClose: () => void;
  loading?: boolean;
}

const DeleteBlockModal: React.FC<DeleteBlockModalProps> = ({
  show,
  blockType,
  onSave,
  onRequestClose,
  loading,
  ...rest
}) => {
  return (
    <Modal open={show} onClose={() => onRequestClose()} {...rest}>
      <Modal.Header>Delete Block</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete this <strong>{blockType}</strong>{" "}
          block?
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onRequestClose()}>Cancel</Button>
        <Button loading={loading ?? false} color="red" onClick={() => onSave()}>
          <Icon name="trash" />
          Delete Block
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteBlockModal;
