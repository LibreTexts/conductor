import {
  Button,
  Checkbox,
  Input,
  Modal,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface ChangeUserEmailModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}

type ChangeUserEmailFormValues = {
  email: string;
  confirmEmail: string;
  confirmChange: boolean;
};

const ChangeUserEmailModal: React.FC<ChangeUserEmailModalProps> = ({
  userId,
  onClose,
  onChanged,
  show,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const {
    register,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChangeUserEmailFormValues>({
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

  const [email, confirmEmail, confirmChange] = watch([
    "email",
    "confirmEmail",
    "confirmChange",
  ]);
  const emailsMatch = !!email && email === confirmEmail;
  const isDisabled = !emailsMatch || !confirmChange;

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
      if (err && "status" in err && err.status === 400) {
        handleGlobalError(
          "Request failed - another user with that email may already exist."
        );
        return;
      }

      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Change User Email</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Stack direction="vertical" gap="md">
            <Input
              type="email"
              label="New Email Address"
              placeholder="user@example.com"
              required
              autoComplete="off"
              error={!!errors.email}
              errorMessage={errors.email?.message}
              {...register("email", {
                required: "Email address is required.",
              })}
            />
            <Input
              type="email"
              label="Confirm New Email Address"
              placeholder="user@example.com"
              required
              autoComplete="off"
              error={!!confirmEmail && !emailsMatch}
              errorMessage={
                !!confirmEmail && !emailsMatch
                  ? "Email addresses do not match."
                  : undefined
              }
              {...register("confirmEmail", {
                required: "Email address is required.",
              })}
            />
            <Text>
              Changing the user&apos;s email address will take effect
              immediately. The user will need to use this email address for all
              future logins. <strong>The user will not be notified of this
              change.</strong> Please ensure they are aware of this change.
            </Text>
            <Checkbox
              name="confirmChange"
              label="I understand"
              required
              checked={confirmChange || false}
              onChange={(checked) => setValue("confirmChange", checked)}
            />
          </Stack>
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
          icon={<IconDeviceFloppy />}
          onClick={handleChangeEmail}
          loading={loading}
          disabled={isDisabled}
        >
          Change Email
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ChangeUserEmailModal;
