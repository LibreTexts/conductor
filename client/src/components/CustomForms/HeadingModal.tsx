import { Modal, Button, Input } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconPlus } from "@tabler/icons-react";
import { useRef, useEffect } from "react";

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
  const textInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (show && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [show]);

  return (
    <Modal open={show} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>{mode === "add" ? "Add" : "Edit"} Heading</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Input
          name="heading-text"
          label="Heading Text"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${mode === "add" ? "new " : ""}heading text...`}
          ref={textInputRef}
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
            {mode === "add" ? "Add" : "Save"} Heading
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default HeadingModal;
