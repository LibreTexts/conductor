import { useState } from "react";
import {
  Button,
  Dropdown,
  Form,
  Icon,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface ConfirmDeleteModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
  type: "page" | "video";
  id: string;
  onDeleted: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  open,
  onClose,
  type,
  id,
  onDeleted,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      if (!id || !type) return;

      const res = await axios.delete(`/kb/featured/${type}/${id}`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onDeleted();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="large" {...rest}>
      <Modal.Header>Remove From Featured Content?</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to remove this {type} from featured content?
          {type === "page" && (
            <span>
              Removing this page from featured content will NOT delete it from
              the knowledge base.
            </span>
          )}
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button color="red" loading={loading} onClick={() => handleDelete()}>
          <Icon name="trash" /> Delete
        </Button>
        <Button onClick={onClose}>
          <Icon name="cancel" /> Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmDeleteModal;
