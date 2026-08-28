import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Combobox,
  Heading,
  IconButton,
  Stack,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { IconPlus, IconUserMinus } from "@tabler/icons-react";
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

const makeColumns = (
  onRemove: (orgID: string) => void,
  removing: boolean
): ColumnDef<CampusAdminRole>[] => [
  {
    id: "organization",
    header: "Organization",
    accessorFn: (row) => row.org.name,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <IconButton
        icon={<IconUserMinus />}
        aria-label={`Remove campus admin role for ${row.original.org.name}`}
        tooltip="Remove campus admin role (demote to member)"
        variant="destructive"
        size="sm"
        loading={removing}
        onClick={() => onRemove(row.original.org.orgID)}
      />
    ),
  },
];

const CampusAdminRolesSection: React.FC<Props> = ({ uuid }) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const { data: adminRoles = [], isFetching: rolesLoading } = useQuery<
    CampusAdminRole[]
  >({
    queryKey: ["user-campus-admin-roles", uuid],
    queryFn: async () => {
      try {
        const res = await api.getUserRoles(uuid);
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.user.roles.filter(
          (r) => r.roleInternal === "campusadmin"
        );
      } catch (err) {
        handleGlobalError(err);
        return [];
      }
    },
    enabled: !!uuid,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: allOrgs = [], isFetching: orgsLoading } = useQuery<
    Organization[]
  >({
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
      addNotification({
        message: "Campus admin role removed (demoted to member).",
        type: "success",
      });
      queryClient.invalidateQueries({
        queryKey: ["user-campus-admin-roles", uuid],
      });
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
      setSelectedOrg(null);
      queryClient.invalidateQueries({
        queryKey: ["user-campus-admin-roles", uuid],
      });
    },
    onError: (err) => handleGlobalError(err),
  });

  const [orgSearch, setOrgSearch] = useState<string>("");

  const grantableOrgs = useMemo(() => {
    const adminOrgIDs = new Set(adminRoles.map((r) => r.org.orgID));
    const query = orgSearch.trim().toLowerCase();
    return allOrgs
      .filter((o) => !adminOrgIDs.has(o.orgID) && o.orgID !== "libretexts")
      .filter((o) => !query || o.name.toLowerCase().includes(query));
  }, [allOrgs, adminRoles, orgSearch]);

  const columns = useMemo(
    () => makeColumns((orgID) => removeMutation.mutate(orgID), removeMutation.isLoading),
    [removeMutation.isLoading]
  );

  const hasGrantableOrgs = !orgsLoading && grantableOrgs.length > 0;

  return (
    <Card>
      <Card.Header>
        <Heading level={3}>Campus Admin Roles</Heading>
      </Card.Header>
      <Card.Body>
        <Stack direction="vertical" gap="md">
          <DataTable<CampusAdminRole>
            data={adminRoles}
            columns={columns}
            loading={rolesLoading}
            density="compact"
            maxHeight="300px"
            bordered
            caption="Campus admin roles held by this user"
            emptyState="No campus admin roles found."
          />
          {hasGrantableOrgs && (
            <div className="flex items-end gap-2">
              <Combobox<Organization>
                className="grow"
                value={selectedOrg}
                onChange={setSelectedOrg}
                by="orgID"
                nullable
              >
                <Combobox.Label>Grant campus admin role</Combobox.Label>
                <Combobox.Input<Organization>
                  placeholder="Select organization to grant..."
                  displayValue={(org) => org?.name ?? ""}
                  onChange={(e) => setOrgSearch(e.target.value)}
                />
                <Combobox.Options>
                  {grantableOrgs.map((org) => (
                    <Combobox.Option<Organization> key={org.orgID} value={org}>
                      {org.name}
                    </Combobox.Option>
                  ))}
                  <Combobox.Empty>No organizations found.</Combobox.Empty>
                </Combobox.Options>
              </Combobox>
              <Button
                icon={<IconPlus />}
                disabled={!selectedOrg}
                loading={grantMutation.isLoading}
                onClick={() =>
                  selectedOrg && grantMutation.mutate(selectedOrg.orgID)
                }
              >
                Grant
              </Button>
            </div>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default CampusAdminRolesSection;
