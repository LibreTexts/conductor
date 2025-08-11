import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";
import Checkbox from "../../NextGenInputs/Checkbox";

interface ChangeUserEmailModalProps extends ModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}

const ChangeUserEmailModal: React.FC<ChangeUserEmailModalProps> = ({
  userId,
  onClose,
  onChanged,
  show,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const { control, reset, getValues, setValue, watch } = useForm<{
    email: string;
    confirmEmail: string;
    confirmChange: boolean;
  }>({
    defaultValues: {
      email: "",
      confirmEmail: "",
      confirmChange: false,
    },
  });

  useEffect(() => {
    if (show) {
      reset();
    }
  }, [show, reset]);

  const isDisabled = useMemo(() => {
    return (
      !watch("email") ||
      !watch("confirmEmail") ||
      !watch("confirmChange") ||
      watch("email") !== watch("confirmEmail")
    );
  }, [watch("email"), watch("confirmEmail"), watch("confirmChange")]);

  async function handleChangeEmail() {
    try {
      if (isDisabled) {
        return;
      }

      setLoading(true);

      const res = await api.changeCentralIdentityUserEmail(
        userId,
        getValues("email")
      );

      if (res.data?.err) {
        throw new Error(res.data.errMsg || "Unknown error");
      }

      addNotification({
        type: "success",
        message: "User email updated successfully.",
      });

      onChanged();
    } catch (err: any) {
      if ("status" in err && err.status === 400) {
        handleGlobalError(
          "Request failed - another user with that email may already exist."
        );
        return;
      }

      console.error("Error updating user email:", err);
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="small" {...rest}>
      <Modal.Header>Change User Email: {userId}</Modal.Header>
      <Modal.Content>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <CtlTextInput
              name="email"
              control={control}
              type="email"
              label="New Email Address"
              placeholder="user@example.com"
              rules={{ required: "Email address is required" }}
              fluid
            />
            <CtlTextInput
              name="confirmEmail"
              control={control}
              type="email"
              label="Confirm New Email Address"
              placeholder="user@example.com"
              rules={{ required: "Email address is required" }}
              fluid
              className="mt-2"
              showErrorMsg
            />
            <p className="mt-4">
              Changing the user's email address will take effect immediately.
              The user will need to use this email address for all future
              logins.
              <strong> The user will not be notified of this change.</strong>{" "}
              Please ensure they are aware of this change.
            </p>
            <Checkbox
              label="I understand"
              name="confirm-change"
              required
              checked={watch("confirmChange") || false}
              onChange={(e) => {
                setValue("confirmChange", e.target.checked);
              }}
              className="mt-2"
            />
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          color="green"
          onClick={handleChangeEmail}
          loading={loading}
          disabled={isDisabled}
        >
          <Icon name="save" /> Change Email
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ChangeUserEmailModal;
