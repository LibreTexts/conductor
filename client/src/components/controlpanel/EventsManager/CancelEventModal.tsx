import { Modal, Button } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import { useTypedSelector } from "../../../state/hooks";

type CancelEventModalProps = {
  eventID: string;
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const CancelEventModal: React.FC<CancelEventModalProps> = ({
  show,
  onClose,
  onConfirm,
}) => {
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Cancel Event</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to cancel this event?{" "}
          <strong>This action cannot be undone</strong> and participants who
          have registered will be notified.
        </p>
        {org.orgID === "libretexts" && (
          <p className="mt-2">
            <em>Any participants who paid registration fees will be refunded.</em>
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Go Back
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={16} />}
            onClick={onConfirm}
          >
            Cancel Event
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default CancelEventModal;
