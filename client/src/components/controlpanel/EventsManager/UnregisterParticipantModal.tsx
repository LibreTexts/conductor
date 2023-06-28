import { Button, Icon, Modal } from "semantic-ui-react";
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
  ...props
}) => {
  // Global State
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Unregister Participant</Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to unregister this participant?{" "}
          <strong>This action cannot be undone</strong>.
        </p>
        {org.orgID === "libretexts" && (
          <p>
            <em>
              If any registration fees were paid, Conductor cannot refund them
              automatically. You will need to manually refund the participant.
            </em>
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onConfirm} color="red">
          <Icon name="ban" />
          Unregister
        </Button>

        <Button onClick={onClose} color="grey">
          Go Back
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default UnregisterParticipantModal;
