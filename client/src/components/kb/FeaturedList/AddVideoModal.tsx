import { useEffect, useState } from "react";
import { Modal, Button, Input } from "@libretexts/davis-react";
import { IconX, IconPlus } from "@tabler/icons-react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import { useForm, Controller } from "react-hook-form";
import { KBFeaturedVideo } from "../../../types";
import { required } from "../../../utils/formRules";

interface AddVideoModalProps {
  open: boolean;
  onClose: () => void;
}

const AddVideoModal: React.FC<AddVideoModalProps> = ({ open, onClose }) => {
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, trigger, reset } = useForm<KBFeaturedVideo>({
    defaultValues: { title: "", url: "" },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) reset();
  }, [open]);

  async function handleSave() {
    try {
      setLoading(true);
      if (!(await trigger())) return;
      const res = await axios.post("/kb/featured/video", { ...getValues() });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.video) throw new Error("Invalid response from server.");
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose()} size="sm">
      <Modal.Header>
        <Modal.Title>Add Featured Video</Modal.Title>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <Controller
          control={control}
          name="title"
          rules={required}
          render={({ field, fieldState: { error } }) => (
            <Input
              {...field}
              name="title"
              label="Title (max 100 chars)"
              placeholder="Title"
              required
              maxLength={100}
              error={!!error}
              errorMessage={error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="url"
          rules={required}
          render={({ field, fieldState: { error } }) => (
            <Input
              {...field}
              name="url"
              label="Video URL (must be embed URL)"
              placeholder="Video URL"
              required
              type="url"
              error={!!error}
              errorMessage={error?.message}
            />
          )}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          icon={<IconX size={16} aria-hidden="true" />}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconPlus size={16} aria-hidden="true" />}
          loading={loading}
          onClick={handleSave}
        >
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddVideoModal;
