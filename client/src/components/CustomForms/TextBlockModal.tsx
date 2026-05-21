import React, { useEffect, useRef } from "react";
import { Modal, Button } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconPlus } from "@tabler/icons-react";
import TextArea from "../TextArea";

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
  const textAreaRef = useRef(null);
  useEffect(() => {
    if (show && textAreaRef.current) {
      (textAreaRef.current as HTMLFormElement).focus();
    }
  }, [show]);

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>{mode === "add" ? "Add" : "Edit"} Text Block</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <TextArea
          placeholder={`Enter ${mode === "add" ? "new " : ""}text...`}
          textValue={value}
          onTextChange={(newVal) => onChange(newVal)}
          innerRef={textAreaRef}
          contentType="text"
        />
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={mode === "add" ? <IconPlus size={16} /> : <IconDeviceFloppy size={16} />}
            loading={loading ?? false}
            onClick={onSave}
          >
            {mode === "add" ? "Add" : "Save"} Text Block
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default TextBlockModal;
