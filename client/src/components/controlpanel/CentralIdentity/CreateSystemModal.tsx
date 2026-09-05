import { useState } from "react";
import { Button, Input, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
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
  onCreated,
}) => {
  const [newSystemName, setNewSystemName] = useState("");
  const [creating, setCreating] = useState(false);
  const { handleGlobalError } = useGlobalError();

  const handleSubmit = async () => {
    if (!newSystemName.trim()) return;

    try {
      setCreating(true);
      const res = await api.postCentralIdentitySystem({
        name: newSystemName.trim(),
        logo: "https://cdn.libretexts.net/DefaultImages/avatar.png",
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to create system");
        return;
      }

      setNewSystemName("");
      onCreated();
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setNewSystemName("");
    onClose();
  };

  return (
    <Modal open={show} onClose={handleClose} size="sm">
      <Modal.Header>
        <Modal.Title>Create New System</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text as="p">Enter the name for the new system.</Text>
          <Input
            name="system-name"
            label="System Name"
            placeholder="Enter system name"
            value={newSystemName}
            onChange={(event) => setNewSystemName(event.target.value)}
            disabled={creating}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" icon={<IconX size={16} />} onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button variant="primary" icon={<IconCheck size={16} />} onClick={handleSubmit} loading={creating} disabled={!newSystemName.trim() || creating}>
            Create
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateSystemModal;
