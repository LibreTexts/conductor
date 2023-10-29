import { Button, Modal, ModalProps } from "semantic-ui-react";
import KBRenderer from "./KBRenderer";

interface PreviewPageModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const PreviewPageModal: React.FC<PreviewPageModalProps> = ({
  show,
  onClose,
  title,
  content,
  ...rest
}) => {
  return (
    <Modal open={show} onClose={() => onClose()} size="fullscreen" {...rest}>
      <Modal.Header>Preview Page: {title}</Modal.Header>
      <Modal.Content>
        <KBRenderer content={content} />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PreviewPageModal;
