import { useRef } from "react";
import { Modal, Button } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import CampusSettingsForm from "./CampusSettingsForm";

type OrgDetailsModalProps = {
  show: boolean;
  onClose: () => void;
  orgID: string;
};

const OrgDetailsModal: React.FC<OrgDetailsModalProps> = ({
  show,
  onClose,
  orgID,
}) => {
  const settingsFormRef =
    useRef<React.ElementRef<typeof CampusSettingsForm>>(null);

  const handleRequestSave = () => {
    settingsFormRef.current?.requestSave();
    onClose();
  };

  return (
    <Modal open={show} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>Edit Organization Details</Modal.Title>
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <CampusSettingsForm
          ref={settingsFormRef}
          orgID={orgID}
          showCatalogSettings={true}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconDeviceFloppy size={16} />}
          onClick={handleRequestSave}
          className="!bg-green-600 hover:!bg-green-700 active:!bg-green-800 focus-visible:!ring-green-600"
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OrgDetailsModal;
