import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Heading,
  Modal,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import useGlobalError from "../../error/ErrorHooks";
import { CentralIdentityApp } from "../../../types/CentralIdentity";
import axios from "axios";

interface AddUserAppModalProps {
  show: boolean;
  userId: string;
  currentApps: string[];
  onClose: () => void;
}

const AddUserAppModal: React.FC<AddUserAppModalProps> = ({
  show,
  userId,
  currentApps,
  onClose,
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [availableApps, setAvailableApps] = useState<CentralIdentityApp[]>([]);
  const [appsToAdd, setAppsToAdd] = useState<string[]>([]);

  // Effects
  useEffect(() => {
    if (!show) return;
    getAvailableApps();
  }, [show, userId]);

  // Methods
  async function getAvailableApps() {
    try {
      setLoading(true);

      const res = await axios.get(`/central-identity/apps`);
      if (
        res.data.err ||
        !res.data.applications ||
        !Array.isArray(res.data.applications)
      ) {
        handleGlobalError(res.data.err);
        return;
      }

      const filtered = res.data.applications.filter(
        (app: CentralIdentityApp) => !currentApps.includes(app.id.toString())
      );

      setAvailableApps(filtered);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submitAddUserApp() {
    try {
      setLoading(true);

      const res = await axios.post(
        `/central-identity/users/${userId}/applications`,
        {
          applications: appsToAdd,
        }
      );

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAll() {
    setAppsToAdd(availableApps.map((app) => app.id.toString()));
  }

  function handleSelectAllDefaultLibs() {
    setAppsToAdd(
      availableApps
        .filter((app) => app.is_default_library)
        .map((app) => app.id.toString())
    );
  }

  function handleSelectAllOthersLibs() {
    setAppsToAdd(
      availableApps
        .filter((app) => !app.is_default_library)
        .map((app) => app.id.toString())
    );
  }

  function toggleAppSelection(appId: string) {
    if (appsToAdd.includes(appId)) {
      setAppsToAdd(appsToAdd.filter((id) => id !== appId));
    } else {
      setAppsToAdd([...appsToAdd, appId]);
    }
  }

  const defaultApps = availableApps.filter((app) => app.is_default_library);
  const otherApps = availableApps.filter((app) => !app.is_default_library);

  return (
    <Modal open={show} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>Add User Application(s)</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Stack direction="vertical" gap="md">
            <div className="flex justify-end">
              <Button variant="tertiary" size="sm" onClick={handleSelectAll}>
                Select all applications
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <section aria-labelledby="default-apps-heading">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Heading level={3} id="default-apps-heading">
                    Default Applications
                  </Heading>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={handleSelectAllDefaultLibs}
                  >
                    Select all defaults
                  </Button>
                </div>
                <Stack direction="vertical" gap="sm">
                  {defaultApps.map((app) => (
                    <Checkbox
                      key={app.id}
                      name={`app-${app.id}`}
                      label={app.name}
                      checked={appsToAdd.includes(app.id.toString())}
                      onChange={() => toggleAppSelection(app.id.toString())}
                    />
                  ))}
                  {defaultApps.length === 0 && (
                    <Text>No default applications available</Text>
                  )}
                </Stack>
              </section>

              <section aria-labelledby="other-apps-heading">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Heading level={3} id="other-apps-heading">
                    Other Applications
                  </Heading>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={handleSelectAllOthersLibs}
                  >
                    Select all others
                  </Button>
                </div>
                <Stack direction="vertical" gap="sm">
                  {otherApps.map((app) => (
                    <Checkbox
                      key={app.id}
                      name={`app-${app.id}`}
                      label={app.name}
                      checked={appsToAdd.includes(app.id.toString())}
                      onChange={() => toggleAppSelection(app.id.toString())}
                    />
                  ))}
                  {otherApps.length === 0 && (
                    <Text>No other applications available</Text>
                  )}
                </Stack>
              </section>
            </div>
          </Stack>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" icon={<IconX />} onClick={onClose}>
          Cancel
        </Button>
        <Button
          icon={<IconDeviceFloppy />}
          onClick={submitAddUserApp}
          disabled={appsToAdd.length === 0}
          loading={loading}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddUserAppModal;
