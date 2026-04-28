import { Button, Modal } from "@libretexts/davis-react";

interface ConfirmModalProps {
  text?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "green" | "red";
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  text = "Are you sure?",
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "green",
}) => {
  const confirmVariant = confirmColor === "red" ? "destructive" : "primary";
  const confirmClassName =
    confirmColor === "green"
      ? "!bg-green-600 hover:!bg-green-700 active:!bg-green-800 focus-visible:!ring-green-600"
      : undefined;

  return (
    <Modal open={true} onClose={() => onCancel()} size="sm">
      <Modal.Header>
        <Modal.Title>Confirm</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-700">{text}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          className={confirmClassName}
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmModal;
