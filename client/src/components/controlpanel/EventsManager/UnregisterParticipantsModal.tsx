import { Button, Icon, Modal } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";

type UnregisterParticipantsModalProps = {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const UnregisterParticipantsModal: React.FC<
  UnregisterParticipantsModalProps
> = ({ show, onClose, onConfirm, ...props }) => {
  // Global State
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Unregister Selected Participant(s)</Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to unregister these participants?{" "}
          <strong>This action cannot be undone</strong>. If participants were
          added to a Conductor project, they will not be automatically removed
          from the project.
        </p>
        {org.orgID === "libretexts" && (
          <p>
            <em>
              If any registration fees were paid, Conductor cannot refund them
              automatically. You will need to manually refund the
              participant(s).
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

export default UnregisterParticipantsModal;
