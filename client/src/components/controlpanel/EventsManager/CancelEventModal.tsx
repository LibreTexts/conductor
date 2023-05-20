import { Button, Icon, Modal } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import { useTypedSelector } from "../../../state/hooks";

type CancelEventModalProps = {
  eventID: string;
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const CancelEventModalProps: React.FC<CancelEventModalProps> = ({
  eventID,
  show,
  onClose,
  onConfirm,
  ...props
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  const org = useTypedSelector((state) => state.org);

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Cancel Event</Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to cancel this event?{" "}
          <strong>This action cannot be undone</strong> and participants who
          have registered will be notified.
        </p>
        {org.orgID === "libretexts" && (
          <p>
            <em>
              Any participants who paid registration fees will be refunded.
            </em>
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onConfirm} color="red">
          <Icon name="trash alternate" />
          Cancel Event
        </Button>

        <Button onClick={onClose} color="grey">
          Go Back
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CancelEventModalProps;
