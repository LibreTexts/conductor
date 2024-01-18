import { useState } from "react";
import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";

interface ConfirmDeleteAuthorModalProps extends ModalProps {
  show: boolean;
  authorID: string;
  onCancel: () => void;
  onDeleted: () => void;
}

const ConfirmDeleteAuthorModal: React.FC<ConfirmDeleteAuthorModalProps> = ({
  show,
  authorID,
  onCancel,
  onDeleted,
  ...rest
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);

  // Methods
  async function handleDelete() {
    try {
      if (!authorID) {
        throw new Error("No author ID provided");
      }

      setLoading(true);

      const res = await api.deleteAuthor(authorID);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.deleted) {
        throw new Error("Failed to delete author.");
      }

      onDeleted();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onDeleted} {...rest}>
      <Modal.Header>Delete Author</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <p className="pa-2r">Are you sure you want to remove this author?</p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="red" onClick={handleDelete}>
          <Icon name="trash alternate outline" />
          Confirm
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmDeleteAuthorModal;
