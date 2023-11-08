import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps } from "semantic-ui-react";
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
          <div className="px-6 pb-36 pt-4">
            <Form noValidate>
              <div className="flex flex-row justify-end">
                <p
                  className="underline mr-4 cursor-pointer"
                  onClick={handleSelectAll}
                >
                  Select All
                </p>
                <p
                  className="underline cursor-pointer"
                  onClick={handleSelectAllDefaultLibs}
                >
                  Select Default Libraries
                </p>
              </div>
              <Form.Select
                label="Add Applications"
                placeholder="Start typing to search by name..."
                options={availableApps.map((app) => ({
                  key: app.id,
                  value: app.id.toString(),
                  text: app.name,
                }))}
                onChange={(_e, { value }) => {
                  if (!value) return;
                  setAppsToAdd(value as string[]);
                }}
                value={appsToAdd.map((app) => app.toString())}
                fluid
                multiple
                search
                selection
                scrolling
                loading={loading}
                disabled={loading}
                clearable
              />
            </Form>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        {appsToAdd.length > 0 && (
          <Button color="green" onClick={submitAddUserApp}>
            <Icon name="save" /> Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserAppModal;
