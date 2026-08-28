import { useEffect, useState } from "react";
import { Button, Modal, Spinner, Textarea } from "@libretexts/davis-react";
import { IconBan, IconX } from "@tabler/icons-react";
import useGlobalError from "../../error/ErrorHooks";
import { useForm } from "react-hook-form";
import { NoteFormData } from "../../../types/Note";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

const MAX_REASON_LENGTH = 150;

interface HandleUserDisableModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
  onDisabled?: () => void;
}

const HandleUserDisableModal: React.FC<HandleUserDisableModalProps> = ({
  show,
  userId,
  onClose,
  onDisabled,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const {
    register,
    reset,
    watch,
    formState: { errors },
  } = useForm<NoteFormData>({
    defaultValues: {
      content: "",
    },
  });

  useEffect(() => {
    if (show) {
      reset({ content: "" });
    }
  }, [show, reset]);

  const reason = watch("content") ?? "";
  const canSubmit =
    reason.trim().length > 0 && reason.length <= MAX_REASON_LENGTH;

  async function handleDisableUser() {
    try {
      if (!userId) return;
      setLoading(true);

      const res = await api.disableCentralIdentityUser(userId, reason);
      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || res.data.err);
        return;
      }

      if (onDisabled) onDisabled();

      addNotification({
        type: "success",
        message: "User successfully disabled.",
      });

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Disable User</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Textarea
            label="Reason"
            helperText="Why are you disabling this user?"
            placeholder="Enter a reason..."
            required
            autoFocus
            rows={4}
            maxLength={MAX_REASON_LENGTH}
            showCharacterCount
            error={!!errors.content}
            errorMessage={errors.content?.message}
            {...register("content", { required: "A reason is required." })}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          icon={<IconX />}
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          icon={<IconBan />}
          onClick={handleDisableUser}
          disabled={!canSubmit}
          loading={loading}
        >
          Disable
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HandleUserDisableModal;
