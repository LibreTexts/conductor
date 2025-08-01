import { useEffect, useState } from "react";
import { Button, Modal, Icon, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import { useForm } from "react-hook-form";
import { NoteFormData } from "../../../types/Note";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface HandleUserDisableModalProps extends ModalProps {
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
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const { control, reset, watch } = useForm<NoteFormData>({
    defaultValues: {
      content: ""
    }
  });

  useEffect(() => {
    if (show) {
      reset({ content: "" });
    }
  }, [show, reset]);

  const reason = watch("content");
  const isOverLimit = reason.length > 150;

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
    <Modal open={show} onClose={onClose} size="small" {...rest}>
      <Modal.Header>
        <Icon name="ban" color="red" /> Disable User
      </Modal.Header>
      <Modal.Content>
        {loading ? (
          <LoadingSpinner />
        ) : (
            <>
                <p className="mb-2">
                    Reason: Why are you disabling this user?
                </p>
                <CtlTextArea
                    name="content"
                    control={control}
                    rules={{ required: "Note content is required" }}
                    maxLength={150}
                    showRemaining
                    fluid
                    bordered
                    placeholder="Enter note content..."
                    autoFocus
                />
            </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {reason.trim().length > 0 && !isOverLimit && (
            <Button color="red" onClick={handleDisableUser} loading={loading}>
                <Icon name="ban" /> Disable
            </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default HandleUserDisableModal;