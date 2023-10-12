import { Button, Modal, ModalProps } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";

interface NewMemberModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
}

const NewMemberModal: React.FC<NewMemberModalProps> = ({
  show,
  onClose,
  rest,
}) => {
  const org = useTypedSelector((state) => state.org);

  return (
    <Modal open={show} closeOnDimmerClick={false} {...rest}>
      <Modal.Header>Welcome to Conductor</Modal.Header>
      <Modal.Content>
        <p>
          Welcome to Conductor! You've been added as a new member of{" "}
          <strong>{org.name}</strong>.
        </p>
        <p>
          <em>
            If you need elevated privileges, please contact the member of your
            organization responsible for communicating with LibreTexts.
          </em>
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()} color="blue">
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default NewMemberModal;