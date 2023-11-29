import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";

interface ConfirmSetOrgDefaultProps extends ModalProps {
  show: boolean;
  selectedUUID: string;
  onClose: () => void;
  onConfirm: (uuid: string) => void;
}

const ConfirmSetOrgDefault: React.FC<ConfirmSetOrgDefaultProps> = ({
  show,
  selectedUUID,
  onClose,
  onConfirm,
  ...rest
}) => {
  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>Set Default Framework</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to set this organization as the campus default?
          Users will be prompted to populate these tags by default when editing a
          file.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button color="green" onClick={() => onConfirm(selectedUUID)}>
          <Icon name="checkmark" /> Yes
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmSetOrgDefault;
