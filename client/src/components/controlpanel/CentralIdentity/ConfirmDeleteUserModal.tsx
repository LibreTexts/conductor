import { useState } from "react";
import { Alert, Button, Input, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconTrash, IconX } from "@tabler/icons-react";

interface ConfirmDeleteUserModalProps {
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
    <Modal open={open} onClose={handleClose} size="lg">
      <Modal.Header>
        <Modal.Title>Delete User</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Alert
            variant="error"
            title="Warning: This action cannot be undone!"
            message={`You are about to permanently delete the entire LibreOne record for ${userName} (UUID: ${userUuid}).`}
          />
          <div>
            <Text weight="semibold">This will permanently:</Text>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
              <li>Delete the user&apos;s LibreOne account</li>
              <li>Remove all associated application licenses</li>
              <li>Remove all organization memberships</li>
              <li>Delete all internal notes</li>
              <li>Remove all access to LibreTexts services</li>
            </ul>
          </div>
          <Input
            name="confirmDelete"
            label='To confirm this action, type "delete" below'
            placeholder="delete"
            required
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          icon={<IconX />}
          onClick={handleClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          icon={<IconTrash />}
          onClick={handleConfirmDelete}
          disabled={!isDeleteConfirmed}
          loading={loading}
        >
          Delete User
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDeleteUserModal;
