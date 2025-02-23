import { Button, Modal, SemanticCOLORS } from "semantic-ui-react";

interface ConfirmModalProps {
  text?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: SemanticCOLORS;
  cancelColor?: SemanticCOLORS;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  text = "Are you sure?",
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "green",
  cancelColor = undefined,
}) => {
  return (
    <Modal size="large" open={true} onClose={onCancel}>
      <Modal.Header>Confirm</Modal.Header>
      <Modal.Content>
        <p>{text}</p>
      </Modal.Content>
      <Modal.Actions>
        <Button color={cancelColor} onClick={onCancel}>
          {cancelText}
        </Button>
        <Button color={confirmColor} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmModal;
