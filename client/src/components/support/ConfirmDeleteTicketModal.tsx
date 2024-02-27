import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";

interface ConfirmDeleteTicketModalProps extends ModalProps {
  open: boolean;
  uuid: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}

const ConfirmDeleteTicketModal: React.FC<ConfirmDeleteTicketModalProps> = ({
  open,
  onClose,
  uuid,
  onConfirmDelete,
  ...rest
}) => {
  return (
    <Modal open={open} onClose={onClose} size="large" {...rest}>
      <Modal.Header>Delete Ticket</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete this ticket?{" "}
          <strong>This action cannot be undone.</strong> Consider closing the
          ticket instead if you want to keep the record.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button color="red" onClick={() => onConfirmDelete()}>
          <Icon name="trash" /> Delete
        </Button>
        <Button onClick={onClose}>
          <Icon name="cancel" /> Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmDeleteTicketModal;
