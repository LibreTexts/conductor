import { Button, Modal, ModalProps } from "semantic-ui-react";

interface LargeDownloadModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
}

const LargeDownloadModal: React.FC<LargeDownloadModalProps> = ({
  show,
  onClose,
  ...rest
}) => {
  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>Large File Requested</Modal.Header>
      <Modal.Content>
        <p>
          The files you've requested will take some time to prepare. We'll
          get your download ready in the background and send you an email when
          it's ready!
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} color="green">OK</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default LargeDownloadModal;
