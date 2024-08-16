import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import { CentralIdentityOrg } from "../../../types/CentralIdentity";
import axios from "axios";
import useDebounce from "../../../hooks/useDebounce";
import api from "../../../api";

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
  const { debounce } = useDebounce();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<CentralIdentityOrg[]>([]);
  const [orgToAdd, setOrgToAdd] = useState<number | undefined>(undefined);

  // Effects
  useEffect(() => {
    if (!show) return;
    getAvailableOrgs();
  }, [show, userId]);

  // Methods
  async function getAvailableOrgs(query?: string) {
    try {
      setLoading(true);

      const res = await api.getCentralIdentityOrgs({
        query,
        limit: 20,
        activePage: 1
      })

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server");
      }

      setAvailableOrgs(res.data.orgs);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const debouncedSearch = debounce((newVal: string) => {
    getAvailableOrgs(newVal);
  }, 200);

  async function submitAddUserOrg() {
    try {
      if (!orgToAdd) return;
      setLoading(true);

      const res = await axios.post(
        `/central-identity/users/${userId}/orgs`,
        {
          orgs: [orgToAdd]
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
    <Modal open={show} onClose={onClose} {...rest} size="small" className="min-h-[25rem]">
      <Modal.Header>Add User Organization(s)</Modal.Header>
      <Modal.Content scrolling id="task-view-content" className="min-h-[25rem]">
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
              value={orgToAdd}
              onChange={(_e, { value }) => {
                if (!value) return;
                setOrgToAdd(value as number);
              }}
              fluid
              search
              
              onSearchChange={(_e, { searchQuery }) => {
                debouncedSearch(searchQuery);
              }}
              selection
              scrolling
              loading={loading}
            />
          </Form>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        {orgToAdd && (
          <Button color="green" onClick={submitAddUserOrg}>
            <Icon name="save" /> Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserOrgModal;
