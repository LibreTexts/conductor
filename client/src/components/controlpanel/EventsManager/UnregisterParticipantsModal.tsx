import { Modal, Button } from "@libretexts/davis-react";
import { IconBan } from "@tabler/icons-react";
import { useTypedSelector } from "../../../state/hooks";

type UnregisterParticipantsModalProps = {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const UnregisterParticipantsModal: React.FC<UnregisterParticipantsModalProps> = ({
  show,
  onClose,
  onConfirm,
}) => {
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Unregister Selected Participant(s)</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          Are you sure you want to unregister these participants?{" "}
          <strong>This action cannot be undone</strong>. If participants were
          added to a Conductor project, they will not be automatically removed
          from the project.
        </p>
        {org.orgID === "libretexts" && (
          <p className="text-sm text-gray-600">
            <em>
              If any registration fees were paid, Conductor cannot refund them
              automatically. You will need to manually refund the participant(s).
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

export default UnregisterParticipantsModal;
