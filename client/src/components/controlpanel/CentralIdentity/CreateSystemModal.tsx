import React, { useState } from "react";
import { Modal, Button, Input, Icon } from "semantic-ui-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import api from "../../../api";

interface CreateSystemModalProps {
  show: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateSystemModal: React.FC<CreateSystemModalProps> = ({
  show,
  onClose,
  onCreated
}) => {
  const [newSystemName, setNewSystemName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const DEFAULT_AVATAR_LOGO_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";
  const { handleGlobalError } = useGlobalError();

  const handleSubmit = async () => {
    if (!newSystemName.trim()) return;

    try {
      setCreating(true);
      const res = await api.postCentralIdentitySystem({
        name: newSystemName,
        logo: DEFAULT_AVATAR_LOGO_URL
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to create system");
        return;
      }

      setNewSystemName("");
      onCreated();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setNewSystemName("");
    onClose();
  };

  return (
    <Modal open={show} onClose={handleClose} size="tiny">
      <Modal.Header>Create New System</Modal.Header>
      <Modal.Content>
        <p>Enter the name for the new system:</p>
        <Input
          fluid
          placeholder="System Name"
          value={newSystemName}
          onChange={(e) => setNewSystemName(e.target.value)}
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
          disabled={!newSystemName.trim() || creating}
        >
          <Icon name="checkmark" /> Create
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateSystemModal;