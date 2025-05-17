import { useState } from "react";
import { Button, Icon, Input, Modal } from "semantic-ui-react";

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
  }

  const handleSave = () => {
    if (newFolderName) {
      onSave(newFolderName);
      setNewFolderName("");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} size="small">
      <Modal.Header>Add Folder</Modal.Header>
      <Modal.Content>
        <p className="mb-2">Enter a name for the new folder. Folder names must be unique.</p>
        <Input
          key="new-folder-name"
          fluid
          placeholder="Enter folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          color="green"
          disabled={!newFolderName}
        >
          <Icon name="plus" />
          Create
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default NewFolderModal;
