import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import {
  CentralIdentityApp,
  CentralIdentityOrg,
} from "../../../types/CentralIdentity";
import axios from "axios";

interface AddUserOrgModalProps extends ModalProps {
  show: boolean;
  userId: string;
  currentOrgs: string[];
  onClose: () => void;
}

const AddUserOrgModal: React.FC<AddUserOrgModalProps> = ({
  show,
  userId,
  currentOrgs,
  onClose,
  ...rest
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<CentralIdentityOrg[]>([]);
  const [orgsToAdd, setOrgsToAdd] = useState<string[]>([]);

  // Effects
  useEffect(() => {
    if (!show) return;
    getAvailableOrgs();
  }, [show, userId]);

  // Methods
  async function getAvailableOrgs() {
    try {
      setLoading(true);

      const res = await axios.get(`/central-identity/orgs`);
      if (
        res.data.err ||
        !res.data.orgs ||
        !Array.isArray(res.data.orgs)
      ) {
        handleGlobalError(res.data.err);
        return;
      }

      const filtered = res.data.orgs.filter(
        (org: CentralIdentityOrg) => !currentOrgs.includes(org.id.toString())
      );

      setAvailableOrgs(filtered);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }
  async function submitAddUserOrg() {
    try {
      setLoading(true);

      const res = await axios.post(
        `/central-identity/users/${userId}/orgs`,
        {
          orgs: orgsToAdd,
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

  return (
    <Modal open={show} onClose={onClose} {...rest} size="small">
      <Modal.Header>Add User Organization(s)</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="pa-2r mb-6r">
            <Form noValidate>
              <Form.Select
                label="Add Organizations"
                placeholder="Start typing to search by name..."
                options={availableOrgs.map((org) => ({
                  key: org.id,
                  value: org.id,
                  text: org.name,
                }))}
                onChange={(_e, { value }) => {
                  if (!value) return;
                  setOrgsToAdd(value as string[]);
                }}
                fluid
                multiple
                search
                selection
                scrolling
                loading={loading}
                disabled={loading}
              />
            </Form>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        {orgsToAdd.length > 0 && (
          <Button color="green" onClick={submitAddUserOrg}>
            <Icon name="save" /> Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserOrgModal;
