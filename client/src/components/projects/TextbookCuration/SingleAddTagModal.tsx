import { Button, Form, Icon, Modal } from "semantic-ui-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { useForm } from "react-hook-form";

interface SingleTagModalProps {
  pageID: string;
  onCancel: () => void;
  onConfirm: (pageID: string, tag: string) => void;
}

const SingleAddTagModal: React.FC<SingleTagModalProps> = ({
  pageID,
  onCancel,
  onConfirm,
}) => {
  const { control, watch, getValues, trigger } = useForm<{
    tag: string;
  }>({
    defaultValues: {
      tag: "",
    },
  });

  const handleConfirm = async () => {
    const isValid = await trigger();
    if (!isValid) return;
    const tag = getValues().tag.trim();
    onConfirm(pageID, tag);
  };

  return (
    <Modal open={true} onClose={() => onCancel()} size="large">
      <Modal.Header>Add Tag</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
        }}>
          <CtlTextInput
            control={control}
            name="tag"
            fluid
            maxLength={255}
            rules={{ required: "Tag is required" }}
            placeholder="Enter a tag"
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          color="green"
          onClick={handleConfirm}
          disabled={watch().tag.length === 0}
        >
          <Icon name="plus" />
          Add
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default SingleAddTagModal;
