import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import { useForm } from "react-hook-form";
import { KBFeaturedVideo } from "../../../types";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { required } from "../../../utils/formRules";

interface AddVideoModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
}

const AddVideoModal: React.FC<AddVideoModalProps> = ({
  open,
  onClose,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, trigger, reset } = useForm<KBFeaturedVideo>({
    defaultValues: {
      title: "",
      url: "",
    },
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      reset(); // Reset form when modal opens
    }
  }, [open]);

  async function handleSave() {
    try {
      setLoading(true);
      if (!(await trigger())) return;

      const res = await axios.post("/kb/featured/video", { ...getValues() });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.video) {
        throw new Error("Invalid response from server.");
      }
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="small" {...rest}>
      <Modal.Header>Add Featured Video</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()}>
          <CtlTextInput
            control={control}
            name="title"
            label="Title (max 100 chars)"
            placeholder="Title"
            rules={required}
            required
            maxLength={100}
          />
          <CtlTextInput
            control={control}
            name="url"
            label="Video URL (must be embed URL)"
            placeholder="Video URL"
            rules={required}
            required
            type="url"
            className="mt-4"
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>
          <Icon name="cancel" /> Cancel
        </Button>
        <Button color="green" loading={loading} onClick={() => handleSave()}>
          <Icon name="plus" /> Add
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddVideoModal;
