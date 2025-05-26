import React, { useState } from "react";
import { Modal, Button, Input, Icon } from "semantic-ui-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import api from "../../../api";

const DEFAULT_AVATAR_LOGO_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";

interface CreateOrgModalProps {
  show: boolean;
  onClose: () => void;
  onCreated: () => void;
  systemId?: number;
}

const CreateOrgModal: React.FC<CreateOrgModalProps> = ({
  show,
  onClose,
  onCreated,
  systemId
}) => {
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const { handleGlobalError } = useGlobalError();

  const handleSubmit = async () => {

    if (!newOrgName.trim() || newOrgName.trim().length < 2 || newOrgName.trim().length > 100) {
      handleGlobalError("Organization name must be between 2 and 100 characters");
      return;
    }

    try {
      setCreating(true);

      const res = await api.postCentralIdentityOrg({
        name: newOrgName,
        logo: DEFAULT_AVATAR_LOGO_URL,
        systemId: systemId
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to create organization");
        return;
      }

      setNewOrgName("");
      onCreated();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setNewOrgName("");
    onClose();
  };

  return (
    <Modal open={show} onClose={handleClose} size="tiny">
      <Modal.Header>Create New Organization</Modal.Header>
      <Modal.Content>
        <p>Enter the name for the new organization:</p>
        <Input
          fluid
          placeholder="Organization Name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          disabled={creating}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          color="green"
          onClick={handleSubmit}
          loading={creating}
          disabled={!newOrgName.trim() || creating}
        >
          <Icon name="checkmark" /> Create
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateOrgModal;