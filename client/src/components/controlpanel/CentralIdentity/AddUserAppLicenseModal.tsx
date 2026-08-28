import { Button, Modal, Select, Spinner } from "@libretexts/davis-react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
  CentralIdentityAppLicense,
  CentralIdentityUserLicenseResult,
} from "../../../types";
import { useQuery } from "@tanstack/react-query";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";

interface AddUserAppLicenseModalProps {
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
        value: app.uuid,
        label: app.name,
      }));
  }, [data, userCurrentApps]);

  async function getAvailableAppLicenses() {
    try {
      const res = await api.getCentralIdentityAvailableAppLicenses();

      if (!res.data || !res.data.licenses) {
        return [];
      }
      return res.data.licenses;
    } catch (err) {
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
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="lg">
      <Modal.Header>
        <Modal.Title>Add User Application License</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Select
            name="applicationLicense"
            label="Application License"
            placeholder="Select an application license"
            options={options}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" icon={<IconX />} onClick={onClose}>
          Cancel
        </Button>
        <Button
          icon={<IconPlus />}
          onClick={submitAddUserAppLicense}
          loading={loading}
          disabled={!selectedId}
        >
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddUserAppLicenseModal;
