import { Button, Icon, Modal, ModalProps, Dropdown } from "semantic-ui-react";
import { useMemo, useState } from "react";
import LoadingSpinner from "../../LoadingSpinner";
import {
  CentralIdentityAppLicense,
  CentralIdentityUserLicenseResult,
} from "../../../types";
import { useQuery } from "@tanstack/react-query";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface AddUserAppLicenseModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  onChanged: () => void;
  userId: string;
  userCurrentApps: CentralIdentityUserLicenseResult[];
}

const AddUserAppLicenseModal: React.FC<AddUserAppLicenseModalProps> = ({
  show,
  onClose,
  onChanged,
  userId,
  userCurrentApps,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const { data, isLoading } = useQuery<CentralIdentityAppLicense[]>({
    queryKey: ["central-identity", "available-app-licenses"],
    queryFn: getAvailableAppLicenses,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const options = useMemo(() => {
    if (!data) return [];
    return data
      .filter(
        (app) =>
          !userCurrentApps.some(
            (userApp) => userApp.application_license.uuid === app.uuid
          )
      )
      .map((app) => ({
        key: app.uuid,
        value: app.uuid,
        text: app.name,
      }));
  }, [data]);

  async function getAvailableAppLicenses() {
    try {
      const res = await api.getCentralIdentityAvailableAppLicenses();

      if (!res.data || !res.data.licenses) {
        return [];
      }
      return res.data.licenses;
    } catch (err) {
      console.error("Error fetching available app licenses:", err);
      handleGlobalError(err);
      return [];
    }
  }

  async function submitAddUserAppLicense() {
    try {
      setLoading(true);
      if (!userId || !selectedId) return;
      const res = await api.grantCentralIdentityAppLicense({
        user_id: userId,
        application_license_id: selectedId,
      });
      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || res.data.err);
        return;
      }

      addNotification({
        type: "success",
        message: "User application license added successfully.",
      });
      onChanged();
    } catch (err) {
      console.error("Error adding user application license:", err);
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} {...rest} size="large">
      <Modal.Header>Add User Application(s)</Modal.Header>
      <Modal.Content>
        {(loading || isLoading) && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && !isLoading && (
          <>
            <p className="mb-2">Select an application license to add</p>
            <Dropdown
              placeholder="Select Application License"
              fluid
              selection
              options={options}
              value={selectedId}
              onChange={(e, { value }) => {
                setSelectedId(value as string);
              }}
            />
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={submitAddUserAppLicense} loading={loading} disabled={!selectedId}>
          <Icon name="plus" /> Add
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserAppLicenseModal;
