import { Modal, Input, Button, Icon } from "semantic-ui-react";

interface HeadingModalProps {
  show: boolean;
  mode: "add" | "edit";
  value: string;
  hasError: boolean;
  onChange: (newVal: string) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}

const HeadingModal: React.FC<HeadingModalProps> = ({
  show,
  mode,
  value,
  hasError,
  onChange,
  onSave,
  onClose,
  loading,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>{mode === "add" ? "Add" : "Edit"} Heading</Modal.Header>
      <Modal.Content>
        <Input
          type="text"
          value={value}
          onChange={(_e, { value }) => onChange(value)}
          fluid
          placeholder={`Enter ${mode === "add" && "new"} heading text...`}
          error={hasError}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={loading ?? false} onClick={onSave}>
          <Icon name={mode === "add" ? "add" : "save"} />
          {mode === "add" ? "Add" : "Save"} Heading
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default HeadingModal;
