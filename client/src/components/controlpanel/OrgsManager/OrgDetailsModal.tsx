import { useRef } from "react";
import { Modal, Button, Icon } from "semantic-ui-react";
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
    <Modal open={show} onClose={onClose} size="fullscreen">
      <Modal.Header>Edit Organization Details</Modal.Header>
      <Modal.Content scrolling>
        <CampusSettingsForm
          ref={settingsFormRef}
          orgID={orgID}
          showCatalogSettings={true}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="green"
          icon
          labelPosition="left"
          onClick={handleRequestSave}
        >
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default OrgDetailsModal;
