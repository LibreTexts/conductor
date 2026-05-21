import { Modal, Button } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";

interface DeleteBlockModalProps {
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
}) => {
  return (
    <Modal open={show} onClose={onRequestClose} size="sm">
      <Modal.Header>
        <Modal.Title>Delete Block</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to delete this <strong>{blockType}</strong> block?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onRequestClose}>Cancel</Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={16} />}
            loading={loading ?? false}
            onClick={onSave}
          >
            Delete Block
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteBlockModal;
