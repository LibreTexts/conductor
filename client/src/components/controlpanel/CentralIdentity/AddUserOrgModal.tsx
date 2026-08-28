import { useEffect, useState } from "react";
import { Button, Combobox, Modal, Select, Stack } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import useGlobalError from "../../error/ErrorHooks";
import { CentralIdentityOrg } from "../../../types/CentralIdentity";
import useDebounce from "../../../hooks/useDebounce";
import api from "../../../api";
import { useMutation, useQuery } from "@tanstack/react-query";

const ADMIN_ROLE_OPTIONS = [{ value: "org_admin", label: "org_admin" }];

interface AddUserOrgModalProps {
  show: boolean;
  userId: string;
  currentOrgs: string[];
  onClose: () => void;
}

const AddUserOrgModal: React.FC<AddUserOrgModalProps> = ({
  show,
  userId,
  onClose,
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  // Data & UI
  const [orgToAdd, setOrgToAdd] = useState<CentralIdentityOrg | null>(null);
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
      setOrgToAdd(null);
      setAdminRole("");
    }
  }, [show]);

  // Methods
  const debouncedSearch = debounce((newVal: string) => {
    setSearchQuery(newVal);
  }, 200);

  const addUserOrgMutation = useMutation({
    mutationFn: async () => {
      if (!orgToAdd) return;
      const res = await api.updateCentralIdentityUserOrgs(userId, [
        orgToAdd.id,
      ]);
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
      const res = await api.updateCentralIdentityUserOrgAdminRole(
        userId,
        orgToAdd.id,
        adminRole
      );
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
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Add User Organization(s)</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="min-h-[20rem]">
        <Stack direction="vertical" gap="lg">
          <Combobox<CentralIdentityOrg>
            value={orgToAdd}
            onChange={setOrgToAdd}
            by="id"
            nullable
          >
            <Combobox.Label>Add Organization</Combobox.Label>
            <Combobox.Input<CentralIdentityOrg>
              placeholder="Start typing to search by name..."
              displayValue={(org) => org?.name ?? ""}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
            <Combobox.Options>
              {(data ?? []).map((org) => (
                <Combobox.Option<CentralIdentityOrg> key={org.id} value={org}>
                  {org.name}
                </Combobox.Option>
              ))}
              <Combobox.Empty>
                {isLoading ? "Searching..." : "No organizations found."}
              </Combobox.Empty>
            </Combobox.Options>
          </Combobox>
          <Select
            name="adminRole"
            label="Admin Role (optional)"
            placeholder="Select an admin role"
            options={ADMIN_ROLE_OPTIONS}
            value={adminRole}
            onChange={(e) => setAdminRole(e.target.value)}
            disabled={!orgToAdd}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" icon={<IconX />} onClick={onClose}>
          Cancel
        </Button>
        <Button
          icon={<IconDeviceFloppy />}
          onClick={() => addUserOrgMutation.mutateAsync()}
          disabled={!orgToAdd}
          loading={
            addUserOrgMutation.isLoading ||
            updateUserAdminRoleMutation.isLoading
          }
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddUserOrgModal;
