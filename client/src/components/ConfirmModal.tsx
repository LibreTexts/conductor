import { Button, Modal } from "@libretexts/davis-react";

interface ConfirmModalProps {
  text?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "green" | "red";
  open?: boolean;
  /**
   * When false, Esc and clicking outside do nothing, so the user must pick
   * one of the buttons. Use when Cancel is itself an action (e.g. "Skip").
   */
  dismissible?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  text = "Are you sure?",
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "green",
  open = true,
  dismissible = true,
}) => {
  const confirmVariant = confirmColor === "red" ? "destructive" : "primary";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (dismissible) onCancel();
      }}
      size="sm"
    >
      <Modal.Header>
        <Modal.Title>Confirm</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-700">{text}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
