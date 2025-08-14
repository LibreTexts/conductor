import { useEffect, useState } from "react";
import { Button, Form, Icon, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import { CentralIdentityOrg } from "../../../types/CentralIdentity";
import axios from "axios";
import useDebounce from "../../../hooks/useDebounce";
import api from "../../../api";
import { useMutation, useQuery } from "@tanstack/react-query";

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
  const [orgToAdd, setOrgToAdd] = useState<number | undefined>(undefined);
  const [adminRole, setAdminRole] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { data, isLoading } = useQuery<CentralIdentityOrg[]>({
    queryKey: ["central-identity-orgs", searchQuery],
    queryFn: async () => {
      const res = await api.getCentralIdentityOrgs({
        query: searchQuery,
        limit: 20,
        activePage: 1,
      });
      return res.data.orgs || [];
    },
    enabled: show,
  });

  useEffect(() => {
    // Ensure state is reset when modal is opened/re-opened
    if (show) {
      setSearchQuery("");
      setOrgToAdd(undefined);
    }
  }, [show]);

  // Methods
  const debouncedSearch = debounce((newVal: string) => {
    setSearchQuery(newVal);
  }, 200);

  const addUserOrgMutation = useMutation({
    mutationFn: async () => {
      if (!orgToAdd) return;
      const res = await api.updateCentralIdentityUserOrgs(userId, [orgToAdd]);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: () => {
      if (adminRole) {
        updateUserAdminRoleMutation.mutateAsync();
      } else {
        onClose();
      }
    },
    onError: (err) => {
      handleGlobalError(err);
    },
  });

  const updateUserAdminRoleMutation = useMutation({
    mutationFn: async () => {
      if (!orgToAdd || !adminRole) return;
      const res = await api.updateCentralIdentityUserOrgAdminRole(userId, orgToAdd, adminRole);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err) => {
      handleGlobalError(err);
    },
  });

  return (
    <Modal
      open={show}
      onClose={onClose}
      {...rest}
      size="small"
      className="min-h-[25rem]"
    >
      <Modal.Header>Add User Organization(s)</Modal.Header>
      <Modal.Content className="min-h-[20rem]">
        <Form noValidate>
          <Form.Select
            label="Add Organization"
            placeholder="Start typing to search by name..."
            options={
              data?.map((org) => ({
                key: org.id,
                value: org.id,
                text: org.name,
              })) || []
            }
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
            loading={isLoading}
          />
          <Form.Select
            label="Admin Role (optional)"
            placeholder="Select an admin role"
            className="!mt-8"
            options={[
              { key: "org_admin", value: "org_admin", text: "org_admin" },
            ]}
            value={adminRole}
            onChange={(_e, { value }) => {
              if (!value) return;
              setAdminRole(value as string);
            }}
            fluid
            disabled={orgToAdd === undefined}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        {orgToAdd !== undefined && (
          <Button
            color="green"
            onClick={() => addUserOrgMutation.mutateAsync()}
            loading={addUserOrgMutation.isLoading}
          >
            <Icon name="save" /> Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default AddUserOrgModal;
