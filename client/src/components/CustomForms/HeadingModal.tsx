import { Modal, Input, Button, Icon, ModalProps } from "semantic-ui-react";
import { useRef, useEffect } from "react";

interface HeadingModalProps extends ModalProps {
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
  ...rest
}) => {
  
  //Auto-focus input on open
  const textInputRef = useRef(null);
  useEffect(() => {
    if (show && textInputRef.current) {
      (textInputRef.current as HTMLFormElement).focus();
    }
  }, [show]);

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>{mode === "add" ? "Add" : "Edit"} Heading</Modal.Header>
      <Modal.Content>
        <Input
          type="text"
          value={value}
          onChange={(_e, { value }) => onChange(value)}
          fluid
          placeholder={`Enter ${mode === "add" && "new"} heading text...`}
          error={hasError}
          ref={textInputRef}
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
