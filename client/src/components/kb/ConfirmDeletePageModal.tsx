import { useState } from "react";
import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";

interface ConfirmDeletePageModalProps extends ModalProps {
  open: boolean;
  id: string;
  onClose: () => void;
  onDeleted: () => void;
}

const ConfirmDeletePageModal: React.FC<ConfirmDeletePageModalProps> = ({
  open,
  onClose,
  id,
  onDeleted,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      if (!id) return;

      const res = await axios.delete(`/kb/page/${id}`);
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
      <Modal.Header>Delete Page?</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete this page?{" "}
          <strong>This action cannot be undone.</strong>
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button color="red" loading={loading} onClick={() => handleDelete()}>
          <Icon name="trash" /> Delete
        </Button>
        <Button onClick={onClose} loading={loading}>
          <Icon name="cancel" /> Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmDeletePageModal;
