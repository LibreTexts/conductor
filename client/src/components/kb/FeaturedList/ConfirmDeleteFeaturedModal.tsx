import { useState } from "react";
import { Modal, Button } from "@libretexts/davis-react";
import { IconTrash, IconX } from "@tabler/icons-react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface ConfirmDeleteFeaturedModalProps {
  open: boolean;
  onClose: () => void;
  type: "page" | "video";
  id: string;
  onDeleted: () => void;
}

const ConfirmDeleteFeaturedModal: React.FC<ConfirmDeleteFeaturedModalProps> = ({
  open,
  onClose,
  type,
  id,
  onDeleted,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      if (!id || !type) return;
      const res = await axios.delete(`/kb/featured/${type}/${id}`);
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
        <Modal.Title>Remove From Featured Content?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to remove this {type} from featured content?
          {type === "page" && (
            <span>
              {" "}Removing this page from featured content will NOT delete it
              from the knowledge base.
            </span>
          )}
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

export default ConfirmDeleteFeaturedModal;
