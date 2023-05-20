import { Modal, TextArea, Button, Icon } from "semantic-ui-react";

interface TextBlockModalProps {
  show: boolean;
  mode: "add" | "edit";
  value: string;
  hasError: boolean;
  onChange: (newVal: string) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}
const TextBlockModal: React.FC<TextBlockModalProps> = ({
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
      <Modal.Header>{mode === "add" ? "Add" : "Edit"} Text Block</Modal.Header>
      <Modal.Content>
        <TextArea
          placeholder={`Enter ${mode === "add" && "new"} text...`}
          textValue={value}
          onTextChange={(newVal: string) => onChange(newVal)}
          contentType="text block"
          error={hasError}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={loading ?? false} onClick={onSave}>
          <Icon name={mode === "add" ? "add" : "save"} />
          {mode === "add" ? "Add" : "Save"} Text Block
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default TextBlockModal;
