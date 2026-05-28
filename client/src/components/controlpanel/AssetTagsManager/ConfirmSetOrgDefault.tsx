import { Button, Modal } from "@libretexts/davis-react";
import { IconCheck } from "@tabler/icons-react";
import { Button, Modal } from "@libretexts/davis-react";
import { IconCheck } from "@tabler/icons-react";

interface ConfirmSetOrgDefaultProps {
interface ConfirmSetOrgDefaultProps {
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
}) => {
  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Set Default Framework</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to set this framework as the campus default?
          Users will be prompted to populate these tags by default when editing a
          file.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconCheck size={16} />}
          onClick={() => onConfirm(selectedUUID)}
        >
          Yes
        <Button
          variant="primary"
          icon={<IconCheck size={16} />}
          onClick={() => onConfirm(selectedUUID)}
        >
          Yes
        </Button>
      </Modal.Footer>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmSetOrgDefault;
