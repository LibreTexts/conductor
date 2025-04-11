import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps, Checkbox } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import { CentralIdentityApp } from "../../../types/CentralIdentity";
import axios from "axios";

interface AddUserAppModalProps extends ModalProps {
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
  ...rest
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
      setAppsToAdd(appsToAdd.filter(id => id !== appId));
    } else {
      setAppsToAdd([...appsToAdd, appId]);
    }
  }

  const defaultApps = availableApps.filter(app => app.is_default_library);
  const otherApps = availableApps.filter(app => !app.is_default_library);

  return (
    <Modal open={show} onClose={onClose} {...rest} size="large">
      <Modal.Header>Add User Application(s)</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="px-6 pb-6 pt-4">
            <div className="flex justify-end mb-2">
              <p className="underline cursor-pointer" onClick={handleSelectAll}>
                Select all applications
              </p>
            </div>
            
            <div className="flex flex-row mb-6">
              <div className="w-1/2 pr-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Default Applications</h3>
                  <p className="underline cursor-pointer" onClick={handleSelectAllDefaultLibs}>
                    Select all defaults
                  </p>
                </div>
                <div>
                  {defaultApps.map((app) => (
                    <div key={app.id} className="mb-2">
                      <Checkbox 
                        label={app.name} 
                        checked={appsToAdd.includes(app.id.toString())}
                        onChange={() => toggleAppSelection(app.id.toString())}
                      />
                    </div>
                  ))}
                  {defaultApps.length === 0 && <p>No default applications available</p>}
                </div>
              </div>
              
              <div className="w-1/2 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">Other Applications</h3>
                  <p className="underline cursor-pointer" onClick={handleSelectAllOthersLibs}>
                    Select all others
                  </p>
                </div>
                <div>
                  {otherApps.map((app) => (
                    <div key={app.id} className="mb-2">
                      <Checkbox 
                        label={app.name} 
                        checked={appsToAdd.includes(app.id.toString())}
                        onChange={() => toggleAppSelection(app.id.toString())}
                      />
                    </div>
                  ))}
                  {otherApps.length === 0 && <p>No other applications available</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        {appsToAdd.length > 0 && (defaultApps.length > 0 || otherApps.length > 0) && (
          <Button color="green" onClick={submitAddUserApp}>
            <Icon name="save" /> Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserAppModal;