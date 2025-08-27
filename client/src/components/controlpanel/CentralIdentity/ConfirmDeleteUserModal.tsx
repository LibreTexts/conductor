import { useState } from "react";
import { Button, Icon, Modal, ModalProps, Input, Message } from "semantic-ui-react";

interface ConfirmDeleteUserModalProps extends ModalProps {
  open: boolean;
  userName: string;
  userUuid: string;
  onClose: () => void;
  onConfirmDelete: () => void;
  loading?: boolean;
}

const ConfirmDeleteUserModal: React.FC<ConfirmDeleteUserModalProps> = ({
  open,
  onClose,
  userName,
  userUuid,
  onConfirmDelete,
  loading = false,
  ...rest
}) => {
  const [confirmText, setConfirmText] = useState("");
  const isDeleteConfirmed = confirmText.toLowerCase() === "delete";

  const handleConfirmDelete = () => {
    if (isDeleteConfirmed) {
      onConfirmDelete();
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="large" {...rest}>
      <Modal.Header>
        <Icon name="warning sign" color="red" />
        Delete User
      </Modal.Header>
      <Modal.Content>
        <Message negative>
          <Message.Header>Warning: This action cannot be undone!</Message.Header>
          <p>
            You are about to permanently delete the entire LibreOne record for{" "}
            <strong>{userName}</strong> (UUID: {userUuid}).
          </p>
        </Message>
        <div className="mb-4">
          <p><strong>This will permanently:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Delete the user's LibreOne account</li>
            <li>Remove all associated application licenses</li>
            <li>Remove all organization memberships</li>
            <li>Delete all internal notes</li>
            <li>Remove all access to LibreTexts services</li>
          </ul>
        </div>
        <div className="mb-4">
          <p className="font-semibold mb-2">
            To confirm this action, please type "delete" in the box below:
          </p>
          <Input
            fluid
            placeholder="Type 'delete' to confirm"
            value={confirmText}
            onChange={(e, { value }) => setConfirmText(value)}
          />
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose} disabled={loading}>
          <Icon name="cancel" />
          Cancel
        </Button>
        <Button
          color="red"
          onClick={handleConfirmDelete}
          disabled={!isDeleteConfirmed || loading}
          loading={loading}
        >
          <Icon name="trash" />
          Delete User
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmDeleteUserModal;
