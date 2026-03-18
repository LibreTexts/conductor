import { useState } from "react";
import { Header, Table, Button, Icon, Dropdown } from "semantic-ui-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useGlobalError from "../../error/ErrorHooks";
import { useNotifications } from "../../../context/NotificationContext";
import { Organization } from "../../../types";
import api from "../../../api";

interface Props {
  uuid: string;
}

type CampusAdminRole = {
  org: Pick<Organization, "orgID" | "name" | "shortName">;
  role: string;
  roleInternal: string;
};

const CampusAdminRolesSection: React.FC<Props> = ({ uuid }) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [selectedOrg, setSelectedOrg] = useState<string>("");

  const { data: adminRoles = [], isFetching: rolesLoading } = useQuery<CampusAdminRole[]>({
    queryKey: ["user-campus-admin-roles", uuid],
    queryFn: async () => {
      try {
        const res = await api.getUserRoles(uuid);
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.user.roles.filter((r) => r.roleInternal === "campusadmin");
      } catch (err) {
        handleGlobalError(err);
        return [];
      }
    },
    enabled: !!uuid,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: allOrgs = [], isFetching: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      try {
        const res = await api.getAllOrganizations();
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.orgs;
      } catch (err) {
        handleGlobalError(err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const removeMutation = useMutation({
    mutationFn: async (orgID: string) => {
      const res = await api.updateUserRole(uuid, orgID, "member");
      if (res.data.err) throw new Error(res.data.errMsg);
      return res;
    },
    onSuccess: () => {
      addNotification({ message: "Campus admin role removed (demoted to member).", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["user-campus-admin-roles", uuid] });
    },
    onError: (err) => handleGlobalError(err),
  });

  const grantMutation = useMutation({
    mutationFn: async (orgID: string) => {
      const res = await api.updateUserRole(uuid, orgID, "campusadmin");
      if (res.data.err) throw new Error(res.data.errMsg);
      return res;
    },
    onSuccess: () => {
      addNotification({ message: "Campus admin role granted.", type: "success" });
      setSelectedOrg("");
      queryClient.invalidateQueries({ queryKey: ["user-campus-admin-roles", uuid] });
    },
    onError: (err) => handleGlobalError(err),
  });

  const adminOrgIDs = new Set(adminRoles.map((r) => r.org.orgID));
  const grantableOrgs = allOrgs.filter((o) => !adminOrgIDs.has(o.orgID) && o.orgID !== "libretexts");
  const orgOptions = grantableOrgs.map((o) => ({
    key: o.orgID,
    text: o.name,
    value: o.orgID,
  }));

  return (
    <div className="flex flex-col rounded-md p-4 shadow-md bg-white h-fit space-y-1.5">
      <div className="flex justify-between items-center mb-4 border-b border-slate-300 pb-2">
        <Header as="h3" className="!m-0">
          Campus Admin Roles
        </Header>
      </div>
      <Table compact celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Organization</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {adminRoles.length > 0 ? (
            adminRoles.map((r) => (
              <Table.Row key={r.org.orgID}>
                <Table.Cell>{r.org.name}</Table.Cell>
                <Table.Cell>
                  <Button
                    icon
                    color="red"
                    size="tiny"
                    loading={removeMutation.isPending}
                    title="Remove campus admin role (demote to member)"
                    onClick={() => removeMutation.mutate(r.org.orgID)}
                  >
                    <Icon name="user delete" />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))
          ) : (
            <Table.Row>
              <Table.Cell colSpan={2} textAlign="center">
                {rolesLoading ? (
                  <em>Loading...</em>
                ) : (
                  <em>No campus admin roles found.</em>
                )}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      {!orgsLoading && grantableOrgs.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <Dropdown
            placeholder="Select organization to grant..."
            selection
            search
            options={orgOptions}
            value={selectedOrg}
            onChange={(_, { value }) => setSelectedOrg(value as string)}
            className="flex-1"
          />
          <Button
            color="green"
            size="small"
            disabled={!selectedOrg}
            loading={grantMutation.isPending}
            onClick={() => grantMutation.mutate(selectedOrg)}
          >
            <Icon name="plus" /> Grant
          </Button>
        </div>
      )}
    </div>
  );
};

export default CampusAdminRolesSection;
