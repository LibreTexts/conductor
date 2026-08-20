import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
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
import type { ColumnDef, PaginationState } from "@libretexts/davis-react-table";
import {
  IconArrowLeft,
  IconEdit,
  IconPlus,
  IconRotateClockwise,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { format, parseISO } from "date-fns";
import { CentralIdentitySystem, CentralIdentityOrg } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useTypedSelector } from "../../../../state/hooks";
import CreateOrgModal from "../../../../components/controlpanel/CentralIdentity/CreateOrgModal";
import api from "../../../../api";

const DEFAULT_AVATAR_LOGO_URL =
  "https://cdn.libretexts.net/DefaultImages/system_logo.png";

const formatTimestamp = (value?: string) =>
  value ? format(parseISO(value), "MM/dd/yyyy hh:mm aa") : "N/A";

const formatDate = (value?: string) =>
  value ? format(parseISO(value), "MM/dd/yyyy") : "N/A";

const CentralIdentitySystemView = () => {
  const { systemId } = useParams<{ systemId: string }>();
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [system, setSystem] = useState<CentralIdentitySystem | null>(null);
  const [editedName, setEditedName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [orgsPage, setOrgsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (systemId && isSuperAdmin) void loadSystem();
  }, [systemId, isSuperAdmin]);

  async function loadSystem() {
    try {
      setLoading(true);
      const res = await api.getCentralIdentitySystem({ systemId });
      if (res.data.err || !res.data.system) {
        handleGlobalError("Failed to load system data.");
        setSystem(null);
        return;
      }

      setSystem(res.data.system);
      setEditedName(res.data.system.name || "");
      setOriginalName(res.data.system.name || "");
    } catch (error) {
      handleGlobalError(error);
      setSystem(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!system || !editedName.trim()) return;

    try {
      setSaving(true);
      const res = await api.putCentralIdentitySystem({
        systemId,
        name: editedName.trim(),
        logo: system.logo || DEFAULT_AVATAR_LOGO_URL,
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to update system.");
        return;
      }

      await loadSystem();
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setSaving(false);
    }
  }

  const organizations = system?.organizations || [];
  const paginatedOrganizations = organizations.slice(
    (orgsPage - 1) * itemsPerPage,
    orgsPage * itemsPerPage
  );

  const columns: ColumnDef<CentralIdentityOrg>[] = [
    {
      id: "logo",
      header: "Logo",
      cell: ({ row }) => (
        <Avatar
          src={row.original.logo || undefined}
          name={row.original.name}
          alt={`${row.original.name} logo`}
          size="sm"
        />
      ),
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      accessorKey: "updated_at",
      header: "Updated",
      cell: ({ row }) => formatDate(row.original.updated_at),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          icon={<IconEdit size={16} aria-hidden="true" />}
          onClick={() =>
            history.push(`/controlpanel/libreone/orgs/org/${row.original.id}`)
          }
        >
          Edit
        </Button>
      ),
    },
  ];

  const paginationState: PaginationState = {
    pageIndex: orgsPage - 1,
    pageSize: itemsPerPage,
  };

  if (!isSuperAdmin) {
    return (
      <div className="!p-8">
        <Alert
          variant="error"
          title="Access denied"
          message="You must be a Superadmin to access this page."
        />
      </div>
    );
  }

  if (loading && !system) {
    return (
      <div className="flex min-h-52 items-center justify-center">
        <Spinner size="lg" />
        <span className="sr-only">Loading system</span>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="!p-8">
        <Card variant="outline" padding="lg">
          <Stack direction="vertical" gap="md" align="center">
            <Heading level={2}>System Not Found</Heading>
            <Text as="p">
              The requested system could not be found or you do not have
              permission to view it.
            </Text>
            <Button
              variant="primary"
              icon={<IconArrowLeft size={16} />}
              onClick={() => history.push("/controlpanel/libreone/orgs")}
            >
              Back to Organizations &amp; Systems
            </Button>
          </Stack>
        </Card>
      </div>
    );
  }

  const hasChanges = editedName.trim() !== originalName;

  return (
    <div className="controlpanel-container !h-full">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Edit System</Heading>

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
              <Breadcrumb.Item isCurrent>Edit System</Breadcrumb.Item>
            </Breadcrumb>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-4">
            <img
              src={system.logo || DEFAULT_AVATAR_LOGO_URL}
              alt={`${system.name} logo`}
              className="w-full max-w-[300px] rounded border border-gray-200 object-contain"
            />
            <Stack direction="vertical" gap="md" className="md:col-span-3">
              <Input
                name="system-name"
                label="Name"
                placeholder="System name"
                value={editedName}
                onChange={(event) => setEditedName(event.target.value)}
                disabled={saving}
              />
              <div>
                <Text as="p" weight="semibold">Created At</Text>
                <Text as="p">{formatTimestamp(system.created_at)}</Text>
              </div>
              <div>
                <Text as="p" weight="semibold">Last Updated At</Text>
                <Text as="p">{formatTimestamp(system.updated_at)}</Text>
              </div>
            </Stack>
          </div>
        </Card>

        <Card
          variant="outline"
          padding="md"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Heading level={3}>Organizations in this System</Heading>
          <Button
            variant="primary"
            icon={<IconPlus size={16} aria-hidden="true" />}
            onClick={() => setShowCreateOrgModal(true)}
          >
            Add Organization
          </Button>
        </Card>

        <DataTable<CentralIdentityOrg>
          data={paginatedOrganizations}
          columns={columns}
          loading={loading}
          density="compact"
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50, 100]}
          tableOptions={{
            manualPagination: true,
            rowCount: organizations.length,
            state: { pagination: paginationState },
            onPaginationChange: (updater) => {
              const nextPagination =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setOrgsPage(nextPagination.pageIndex + 1);
              setItemsPerPage(nextPagination.pageSize);
            },
          }}
        />

        <div className="flex flex-wrap justify-between gap-2">
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
              icon={<IconRotateClockwise size={16} />}
              onClick={() => setEditedName(originalName)}
              disabled={!hasChanges || saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              disabled={!hasChanges || !editedName.trim()}
              loading={saving}
            >
              Save
            </Button>
          </div>
        </div>
      </Stack>

      <CreateOrgModal
        show={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreated={() => {
          setShowCreateOrgModal(false);
          void loadSystem();
        }}
        systemId={system.id}
      />
    </div>
  );
};

export default CentralIdentitySystemView;
