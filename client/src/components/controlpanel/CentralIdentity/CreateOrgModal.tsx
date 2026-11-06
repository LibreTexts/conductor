import { useState } from "react";
import { Button, Input, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
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
  systemId,
}) => {
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const { handleGlobalError } = useGlobalError();

  const handleSubmit = async () => {
    const name = newOrgName.trim();
    if (name.length < 2 || name.length > 100) {
      handleGlobalError("Organization name must be between 2 and 100 characters");
      return;
    }

    try {
      setCreating(true);
      const res = await api.postCentralIdentityOrg({
        name,
        logo: DEFAULT_AVATAR_LOGO_URL,
        systemId,
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to create organization");
        return;
      }

      setNewOrgName("");
      onCreated();
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setNewOrgName("");
    onClose();
  };

  return (
    <Modal open={show} onClose={handleClose} size="sm">
      <Modal.Header>
        <Modal.Title>Create New Organization</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text as="p">Enter the name for the new organization.</Text>
          <Input
            name="organization-name"
            label="Organization Name"
            placeholder="Enter organization name"
            value={newOrgName}
            onChange={(event) => setNewOrgName(event.target.value)}
            disabled={creating}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" icon={<IconX size={16} />} onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button variant="primary" icon={<IconCheck size={16} />} onClick={handleSubmit} loading={creating} disabled={newOrgName.trim().length < 2 || newOrgName.trim().length > 100 || creating}>
            Create
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateOrgModal;
