import { Modal, Button } from "@libretexts/davis-react";
import { IconBan } from "@tabler/icons-react";
import { useTypedSelector } from "../../../state/hooks";

type UnregisterParticipantModalProps = {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const UnregisterParticipantModal: React.FC<UnregisterParticipantModalProps> = ({
  show,
  onClose,
  onConfirm,
}) => {
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Unregister Participant</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          Are you sure you want to unregister this participant?{" "}
          <strong>This action cannot be undone</strong>.
        </p>
        {org.orgID === "libretexts" && (
          <p className="text-sm text-gray-600">
            <em>
              If any registration fees were paid, Conductor cannot refund them
              automatically. You will need to manually refund the participant.
            </em>
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Go Back</Button>
          <Button variant="destructive" icon={<IconBan size={16} />} onClick={onConfirm}>
            Unregister
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default UnregisterParticipantModal;
