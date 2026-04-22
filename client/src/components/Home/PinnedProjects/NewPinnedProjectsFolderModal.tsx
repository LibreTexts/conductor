import { useState } from "react";
import { Button, Input, Modal } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";

interface NewPinnedProjectsFolderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}

const NewFolderModal: React.FC<NewPinnedProjectsFolderModalProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [newFolderName, setNewFolderName] = useState("");

  const handleClose = () => {
    setNewFolderName("");
    onClose();
  };

  const handleSave = () => {
    if (newFolderName) {
      onSave(newFolderName);
      setNewFolderName("");
    }
  };

  return (
    <Modal open={open} onClose={() => handleClose()} size="sm">
      <Modal.Header>
        <Modal.Title>Add Folder</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-gray-600 mb-3">
          Enter a name for the new folder. Folder names must be unique.
        </p>
        <Input
          name="folder-name"
          label="Folder Name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Enter folder name"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!newFolderName}
          icon={<IconPlus size={16} />}
        >
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewFolderModal;
