import { Button, Dropdown, Icon, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { EditAcademyOnlineAccessFormValues } from "../../../types";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { academyOnlineAccessLevels } from "../../../utils/centralIdentityHelpers";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface EditUserAcademyOnlineModalProps extends ModalProps {
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
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const { control, reset, getValues } =
    useForm<EditAcademyOnlineAccessFormValues>({
      defaultValues: {
        academy_online: 0,
        academy_online_expires_in_days: 0,
      },
    });

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
          academy_online: getValues("academy_online"),
          academy_online_expires_in_days: getValues(
            "academy_online_expires_in_days"
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
      console.error("Error updating academy online access:", err);
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="small" {...rest}>
      <Modal.Header>Change User Academy Online Access</Modal.Header>
      <Modal.Content>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <label
              htmlFor="academy_online"
              className="form-field-label !mb-1.5"
            >
              New Academy Online Access Level
            </label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="academy_online"
                  options={academyOnlineAccessLevels}
                  {...field}
                  onChange={(e, data) => {
                    field.onChange(data.value ?? 0);
                  }}
                  fluid
                  selection
                  placeholder="Select access level"
                />
              )}
              name="academy_online"
              control={control}
            />
            <CtlTextInput
              name="academy_online_expires_in_days"
              control={control}
              type="number"
              label="Number of days until access expires (leave 0 for no expiration, maximum 730 days)"
              placeholder="Enter number of days until access expires"
              rules={{ required: "Access expiration is required" }}
              fluid
              className="mt-4"
            />
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color="green" onClick={handleUpdateAccess} loading={loading}>
          <Icon name="save" /> Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditUserAcademyOnlineModal;
