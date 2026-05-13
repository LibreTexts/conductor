import { useState } from "react";
import { Modal, Button } from "@libretexts/davis-react";
import { IconTrash, IconX } from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";

interface ConfirmDeletePageModalProps {
  open: boolean;
  uuid: string;
  onClose: () => void;
  onDeleted: () => void;
}

const ConfirmDeletePageModal: React.FC<ConfirmDeletePageModalProps> = ({
  open,
  onClose,
  uuid,
  onDeleted,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      if (!uuid) return;
      const res = await axios.delete(`/kb/page/${uuid}`);
      if (res.data.err) throw new Error(res.data.errMsg);
      onDeleted();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose()} size="sm">
      <Modal.Header>
        <Modal.Title>Delete Page?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to delete this page?{" "}
          <strong>This action cannot be undone.</strong>
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="destructive"
          icon={<IconTrash size={16} aria-hidden="true" />}
          loading={loading}
          onClick={handleDelete}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          icon={<IconX size={16} aria-hidden="true" />}
          disabled={loading}
          onClick={onClose}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDeletePageModal;
