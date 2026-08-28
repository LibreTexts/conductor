import {
  Alert,
  Button,
  Checkbox,
  IconButton,
  Input,
  Modal,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import {
  IconEye,
  IconEyeOff,
  IconKey,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";
import CopyValueButton from "../../util/CopyValueButton";
import {
  PASSWORD_RULES_TEXT,
  generateSecurePassword,
  meetsPasswordRules,
} from "../../../utils/centralIdentityHelpers";

interface ResetUserPasswordModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
  onReset?: () => void;
}

type ResetUserPasswordFormValues = {
  newPassword: string;
  confirmPassword: string;
  confirmChange: boolean;
};

const WARNING_MESSAGE =
  "The user is not notified of this change. It takes effect immediately and signs them out of all active sessions. Make sure you can deliver the new password to them.";

const ResetUserPasswordModal: React.FC<ResetUserPasswordModalProps> = ({
  show,
  userId,
  onClose,
  onReset,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Cleared by any manual keystroke: a value the admin typed still needs confirming,
  // a value they generated and can read on screen does not.
  const [wasGenerated, setWasGenerated] = useState(false);
  const [result, setResult] = useState<{
    password: string;
    sessionsInvalidated: boolean;
  } | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const {
    register,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ResetUserPasswordFormValues>({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
      confirmChange: false,
    },
  });

  useEffect(() => {
    if (show) {
      reset();
      setShowPassword(false);
      setWasGenerated(false);
      setResult(null);
    }
  }, [show, reset]);

  // The generated password is the admin's only copy, so move focus to the panel that
  // holds it rather than leaving focus on a button that no longer exists.
  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  const [newPassword, confirmPassword, confirmChange] = watch([
    "newPassword",
    "confirmPassword",
    "confirmChange",
  ]);

  const passwordsMatch = !!newPassword && newPassword === confirmPassword;
  const meetsRules = meetsPasswordRules(newPassword ?? "");
  const canSubmit =
    meetsRules && (wasGenerated || passwordsMatch) && !!confirmChange;

  const passwordRegistration = register("newPassword", {
    required: "A password is required.",
  });

  function handleGeneratePassword() {
    setValue("newPassword", generateSecurePassword(), { shouldDirty: true });
    setValue("confirmPassword", "");
    setWasGenerated(true);
    setShowPassword(true);
  }

  async function handleResetPassword() {
    try {
      if (!userId || !canSubmit) return;
      setLoading(true);

      const password = getValues("newPassword");
      const res = await api.changeCentralIdentityUserPassword(userId, password);

      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || "Unknown error");
        return;
      }

      addNotification({
        type: "success",
        message: "User password reset successfully.",
      });

      setResult({
        password,
        sessionsInvalidated: !!res.data?.sessions_invalidated,
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    if (onReset) onReset();
    onClose();
  }

  return (
    <Modal open={show} onClose={result ? handleDone : onClose} size="md">
      <Modal.Header>
        <Modal.Title>Reset User Password</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : result ? (
          <div ref={successRef} tabIndex={-1} className="focus:outline-none">
            <Stack direction="vertical" gap="md">
              <Alert
                variant="success"
                title=""
                message={
                  result.sessionsInvalidated
                    ? "Change successful. The new password is active now and the user has been signed out of all active sessions."
                    : "Change successful. The new password is active now."
                }
              />
              <div>
                <Text size="sm" weight="semibold" color="muted">
                  New Password
                </Text>
                <div className="flex items-center gap-2">
                  <code className="font-mono break-all rounded-md bg-neutral-100 px-2 py-1">
                    {result.password}
                  </code>
                  <CopyValueButton
                    value={result.password}
                    label="Copy new password"
                  />
                </div>
              </div>
              <Text>
                This password cannot be retrieved again. Copy it now and share
                it with the user through a channel you trust.
              </Text>
            </Stack>
          </div>
        ) : (
          <Stack direction="vertical" gap="md">
            <div className="flex items-start gap-2">
              <Input
                {...passwordRegistration}
                onChange={(e) => {
                  setWasGenerated(false);
                  passwordRegistration.onChange(e);
                }}
                type={showPassword ? "text" : "password"}
                label="New Password"
                required
                autoComplete="new-password"
                className="grow"
                helperText={PASSWORD_RULES_TEXT}
                error={!!errors.newPassword || (!!newPassword && !meetsRules)}
                errorMessage={
                  !!newPassword && !meetsRules
                    ? PASSWORD_RULES_TEXT
                    : errors.newPassword?.message
                }
              />
              <div className="flex items-center gap-1 pt-7">
                <IconButton
                  icon={showPassword ? <IconEyeOff /> : <IconEye />}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tooltip={showPassword ? "Hide password" : "Show password"}
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword((prev) => !prev)}
                />
                <CopyValueButton
                  value={newPassword ?? ""}
                  label="Copy password"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IconRefresh />}
                  onClick={handleGeneratePassword}
                >
                  Generate
                </Button>
              </div>
            </div>
            <p aria-live="polite" className="sr-only">
              {wasGenerated ? "A new password has been generated." : ""}
            </p>
            {!wasGenerated && (
              <Input
                type="password"
                label="Confirm New Password"
                required
                autoComplete="new-password"
                error={!!confirmPassword && !passwordsMatch}
                errorMessage={
                  !!confirmPassword && !passwordsMatch
                    ? "Passwords do not match."
                    : undefined
                }
                {...register("confirmPassword")}
              />
            )}
            <Alert
              variant="warning"
              title=""
              message={WARNING_MESSAGE}
            />
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
        {result ? (
          <Button onClick={handleDone}>Done</Button>
        ) : (
          <>
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
              icon={<IconKey />}
              onClick={handleResetPassword}
              disabled={!canSubmit}
              loading={loading}
            >
              Reset Password
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResetUserPasswordModal;
