import { Modal, Button } from "@libretexts/davis-react";
import { IconX } from "@tabler/icons-react";
import KBRenderer from "./KBRenderer";

interface PreviewPageModalProps {
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
}) => {
  return (
    <Modal open={show} onClose={() => onClose()} size="xl">
      <Modal.Header>
        <Modal.Title>Preview Page: {title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <KBRenderer content={content} />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          icon={<IconX size={16} aria-hidden="true" />}
          onClick={onClose}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PreviewPageModal;
