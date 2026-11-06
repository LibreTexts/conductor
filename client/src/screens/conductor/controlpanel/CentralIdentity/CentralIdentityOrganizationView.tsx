import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Heading,
  Input,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import api from "../../../../api";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useTypedSelector } from "../../../../state/hooks";
import {
  CentralIdentityOrg,
  CentralIdentityOrgAdminResult,
} from "../../../../types";

const DEFAULT_LOGO_URL =
  "https://cdn.libretexts.net/DefaultImages/avatar.png";

const formatTimestamp = (value?: string) =>
  value ? format(parseISO(value), "MM/dd/yyyy hh:mm aa") : "N/A";

const CentralIdentityOrganizationView = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [editedName, setEditedName] = useState("");
  const [originalName, setOriginalName] = useState("");

  const { data, isLoading } = useQuery<CentralIdentityOrg>({
    queryKey: ["central-identity-org", id],
    queryFn: async () => {
      const res = await api.getCentralIdentityOrg({ orgId: id });
      return res.data.org;
    },
    enabled: !!id && isSuperAdmin,
  });

  const { data: admins, isLoading: isLoadingAdmins } = useQuery<
    CentralIdentityOrgAdminResult[]
  >({
    queryKey: ["central-identity-org-admins", id],
    queryFn: async () => {
      const res = await api.getCentralIdentityOrgAdmins(id);
      return res.data.admins;
    },
    enabled: !!id && isSuperAdmin,
  });

  useEffect(() => {
    if (!data) return;
    setEditedName(data.name || "");
    setOriginalName(data.name || "");
  }, [data]);

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const res = await api.patchCentralIdentityOrg({
        orgId: data.id,
        name: editedName.trim(),
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg || "Failed to update organization.");
      }
    },
    onError: handleGlobalError,
    onSuccess: async () => {
      setOriginalName(editedName.trim());
      await queryClient.invalidateQueries(["central-identity-org", id]);
    },
  });

  const adminColumns: ColumnDef<CentralIdentityOrgAdminResult>[] = [
    {
      id: "first_name",
      header: "First Name",
      accessorFn: (admin) => admin.user?.first_name || "N/A",
    },
    {
      id: "last_name",
      header: "Last Name",
      accessorFn: (admin) => admin.user?.last_name || "N/A",
    },
    {
      id: "email",
      header: "Email",
      accessorFn: (admin) => admin.user?.email || "N/A",
    },
    { accessorKey: "admin_role", header: "Admin Role" },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="!p-8">
        <Alert
          variant="error"
          title="Access denied"
          message="Insufficient authorization."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-52 items-center justify-center">
        <Spinner size="lg" />
        <span className="sr-only">Loading organization</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="!p-8">
        <Card variant="outline" padding="lg">
          <Stack direction="vertical" gap="md" align="center">
            <Heading level={2}>Organization Not Found</Heading>
            <Text as="p">
              The requested organization could not be found or you do not have
              permission to view it.
            </Text>
          </Stack>
        </Card>
      </div>
    );
  }

  const hasChanges = editedName.trim() !== originalName;

  return (
    <div className="controlpanel-container !h-full">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Edit Organization</Heading>

        <Card variant="outline" padding="none" className="overflow-hidden">
          <div className="border-b border-gray-200 p-4">
            <Breadcrumb>
              <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
              <Breadcrumb.Item href="/controlpanel/libreone">
                LibreOne Admin Console
              </Breadcrumb.Item>
              <Breadcrumb.Item href="/controlpanel/libreone/orgs">
                Organizations &amp; Systems
              </Breadcrumb.Item>
              <Breadcrumb.Item isCurrent>Edit Organization</Breadcrumb.Item>
            </Breadcrumb>
          </div>

          <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-4">
            <img
              src={data.logo || DEFAULT_LOGO_URL}
              alt={`${data.name} logo`}
              className="w-full max-w-[300px] rounded border border-gray-200 object-contain"
            />

            <Stack direction="vertical" gap="lg" className="md:col-span-3">
              <div className="border-b border-gray-200 pb-2">
                <Heading level={3}>Properties</Heading>
              </div>

              <Input
                name="org-name"
                label="Organization Name"
                placeholder="Organization name"
                value={editedName}
                onChange={(event) => setEditedName(event.target.value)}
                disabled={updateOrgMutation.isLoading}
              />

              <div className="flex flex-wrap gap-8">
                <div>
                  <Text as="p" weight="semibold">Created At</Text>
                  <Text as="p">{formatTimestamp(data.created_at)}</Text>
                </div>
                <div>
                  <Text as="p" weight="semibold">Updated At</Text>
                  <Text as="p">{formatTimestamp(data.updated_at)}</Text>
                </div>
              </div>

              <Stack direction="vertical" gap="md">
                <div className="border-b border-gray-200 pb-2">
                  <Heading level={3}>Administrators</Heading>
                </div>
                <DataTable<CentralIdentityOrgAdminResult>
                  data={admins || []}
                  columns={adminColumns}
                  loading={isLoadingAdmins}
                  density="compact"
                  onRowClick={(admin) =>
                    window.open(`/controlpanel/libreone/users/${admin.user_id}`)
                  }
                />
              </Stack>
            </Stack>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 p-4">
            <Button
              variant="outline"
              icon={<IconArrowLeft size={16} />}
              onClick={() => history.goBack()}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={<IconX size={16} />}
                onClick={() => setEditedName(originalName)}
                disabled={!hasChanges || updateOrgMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={<IconDeviceFloppy size={16} />}
                onClick={() => updateOrgMutation.mutate(undefined)}
                disabled={!hasChanges || !editedName.trim()}
                loading={updateOrgMutation.isLoading}
              >
                Save
              </Button>
            </div>
          </div>
        </Card>
      </Stack>
    </div>
  );
};

export default CentralIdentityOrganizationView;
