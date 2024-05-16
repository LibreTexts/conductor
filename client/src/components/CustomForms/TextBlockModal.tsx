import React, { useEffect, useRef } from "react";
import { Modal, Button, Icon, ModalProps } from "semantic-ui-react";
import TextArea from "../TextArea";

interface TextBlockModalProps extends ModalProps {
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
  ...rest
}) => {
  // Focus on text area when modal is opened
  const textAreaRef = useRef(null);
  useEffect(() => {
    if (show && textAreaRef.current) {
      (textAreaRef.current as HTMLFormElement).focus();
    }
  }, [show]);

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>{mode === "add" ? "Add" : "Edit"} Text Block</Modal.Header>
      <Modal.Content>
        <TextArea
          placeholder={`Enter ${mode === "add" && "new"} text...`}
          textValue={value}
          onTextChange={(newVal) => onChange(newVal)}
          innerRef={textAreaRef}
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
