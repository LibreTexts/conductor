import { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { Alert, Avatar, Breadcrumb, Button, Heading, Stack } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, PaginationState } from "@libretexts/davis-react-table";
import {
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconPlus,
} from "@tabler/icons-react";
import { CentralIdentityOrg, CentralIdentitySystem } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useTypedSelector } from "../../../../state/hooks";
import CreateSystemModal from "../../../../components/controlpanel/CentralIdentity/CreateSystemModal";
import CreateOrgModal from "../../../../components/controlpanel/CentralIdentity/CreateOrgModal";
import api from "../../../../api";

type OrganizationTableRow = {
  id: number;
  name: string;
  logo?: string | null;
  type: "system" | "org";
  isChild?: boolean;
  organizations?: CentralIdentityOrg[];
};

const CentralIdentityOrgs = () => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [systems, setSystems] = useState<CentralIdentitySystem[]>([]);
  const [organizations, setOrganizations] = useState<CentralIdentityOrg[]>([]);
  const [expandedSystemIds, setExpandedSystemIds] = useState<number[]>([]);
  const [showCreateSystemModal, setShowCreateSystemModal] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) void loadData();
  }, [isSuperAdmin]);

  async function loadData() {
    try {
      setLoading(true);
      const [systemsRes, orgsRes] = await Promise.all([
        api.getCentralIdentitySystems(),
        api.getCentralIdentityOrgs(),
      ]);

      setSystems(systemsRes.data.systems || []);
      setOrganizations(
        (orgsRes.data.orgs as CentralIdentityOrg[]).filter((org) => !org.system)
      );
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  }

  const topLevelRows = useMemo<OrganizationTableRow[]>(
    () => [
      ...systems.map((system) => ({ ...system, type: "system" as const })),
      ...organizations.map((organization) => ({
        ...organization,
        type: "org" as const,
      })),
    ],
    [systems, organizations]
  );

  const visibleRows = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    return topLevelRows
      .slice(startIndex, startIndex + itemsPerPage)
      .flatMap((row) => {
        if (row.type !== "system" || !expandedSystemIds.includes(row.id)) {
          return [row];
        }

        const childRows: OrganizationTableRow[] = (row.organizations || []).map(
          (organization) => ({
            ...organization,
            type: "org",
            isChild: true,
          })
        );
        return [row, ...childRows];
      });
  }, [activePage, expandedSystemIds, itemsPerPage, topLevelRows]);

  const toggleSystemExpand = (systemId: number) => {
    setExpandedSystemIds((current) =>
      current.includes(systemId)
        ? current.filter((id) => id !== systemId)
        : [...current, systemId]
    );
  };

  const handleView = (row: OrganizationTableRow) => {
    history.push(
      `/controlpanel/libreone/orgs/${row.type === "org" ? "org" : "system"}/${row.id}`
    );
  };

  const columns: ColumnDef<OrganizationTableRow>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        const item = row.original;
        if (item.type !== "system") return null;
        const expanded = expandedSystemIds.includes(item.id);

        return (
          <Button
            variant="ghost"
            icon={expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            onClick={(event) => {
              event.stopPropagation();
              toggleSystemExpand(item.id);
            }}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.name}`}
          />
        );
      },
    },
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
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row, getValue }) => (
        <span className={row.original.isChild ? "pl-6" : "font-semibold"}>
          {getValue<string>()}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) =>
        row.original.type === "system" ? "System" : "Organization",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          icon={<IconEye size={16} aria-hidden="true" />}
          onClick={(event) => {
            event.stopPropagation();
            handleView(row.original);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const paginationState: PaginationState = {
    pageIndex: activePage - 1,
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

  return (
    <div className="!h-full !p-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Console: Organizations &amp; Systems</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone">
            LibreOne Admin Console
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Organizations &amp; Systems</Breadcrumb.Item>
        </Breadcrumb>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<IconPlus size={16} aria-hidden="true" />}
            onClick={() => setShowCreateSystemModal(true)}
          >
            New System
          </Button>
          <Button
            variant="outline"
            icon={<IconPlus size={16} aria-hidden="true" />}
            onClick={() => setShowCreateOrgModal(true)}
          >
            New Organization
          </Button>
        </div>
        <DataTable<OrganizationTableRow>
          data={visibleRows}
          columns={columns}
          loading={loading}
          density="compact"
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50, 100]}
          tableOptions={{
            manualPagination: true,
            rowCount: topLevelRows.length,
            state: { pagination: paginationState },
            getRowId: (row) => `${row.type}-${row.id}${row.isChild ? "-child" : ""}`,
            onPaginationChange: (updater) => {
              const nextPagination =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setActivePage(nextPagination.pageIndex + 1);
              setItemsPerPage(nextPagination.pageSize);
            },
          }}
        />
      </Stack>

      <CreateSystemModal
        show={showCreateSystemModal}
        onClose={() => setShowCreateSystemModal(false)}
        onCreated={() => {
          setShowCreateSystemModal(false);
          void loadData();
        }}
      />
      <CreateOrgModal
        show={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreated={() => {
          setShowCreateOrgModal(false);
          void loadData();
        }}
      />
    </div>
  );
};

export default CentralIdentityOrgs;
