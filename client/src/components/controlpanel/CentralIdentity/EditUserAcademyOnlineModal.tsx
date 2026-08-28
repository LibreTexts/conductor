import { Button, Input, Modal, Select, Spinner, Stack } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { EditAcademyOnlineAccessFormValues } from "../../../types";
import {
  academyOnlineAccessLevels,
  toSelectOptions,
} from "../../../utils/centralIdentityHelpers";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface EditUserAcademyOnlineModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}

const EditUserAcademyOnlineModal: React.FC<EditUserAcademyOnlineModalProps> = ({
  userId,
  onClose,
  onChanged,
  show,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const {
    control,
    register,
    reset,
    getValues,
    formState: { errors },
  } = useForm<EditAcademyOnlineAccessFormValues>({
    defaultValues: {
      academy_online: 0,
      academy_online_expires_in_days: 0,
    },
  });

  // Davis' Select is string-valued, so the numeric access levels are stringified
  // here and coerced back to numbers in the Controller's onChange.
  const accessLevelOptions = useMemo(
    () => toSelectOptions(academyOnlineAccessLevels),
    []
  );

  useEffect(() => {
    if (show) {
      reset();
    }
  }, [show, reset]);

  async function handleUpdateAccess() {
    try {
      setLoading(true);

      const res = await api.updateCentralIdentityUserAcademyOnlineAccess(
        userId,
        {
          academy_online: Number(getValues("academy_online")),
          academy_online_expires_in_days: Number(
            getValues("academy_online_expires_in_days")
          ),
        }
      );

      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || res.data.err);
        return;
      }

      addNotification({
        type: "success",
        message: "User Academy Online access updated successfully.",
      });

      onChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Change User Academy Online Access</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Stack direction="vertical" gap="md">
            <Controller
              name="academy_online"
              control={control}
              render={({ field }) => (
                <Select
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  label="New Academy Online Access Level"
                  placeholder="Select access level"
                  options={accessLevelOptions}
                  value={String(field.value ?? 0)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              )}
            />
            <Input
              type="number"
              label="Days until access expires"
              helperText="Leave 0 for no expiration; maximum 730 days."
              placeholder="0"
              required
              error={!!errors.academy_online_expires_in_days}
              errorMessage={errors.academy_online_expires_in_days?.message}
              {...register("academy_online_expires_in_days", {
                required: "Access expiration is required.",
                min: { value: 0, message: "Must be 0 or greater." },
                max: { value: 730, message: "Must be 730 or fewer days." },
              })}
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
          onClick={handleUpdateAccess}
          loading={loading}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditUserAcademyOnlineModal;
