import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Breadcrumb,
  Button,
  Heading,
  Input,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { IconEdit } from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks.js";
import OrgDetailsModal from "./OrgsManager/OrgDetailsModal.js";
import { Organization } from "../../types/Organization.js";

const OrganizationsManager = () => {
  const { handleGlobalError } = useGlobalError();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [searchString, setSearchString] = useState<string>("");
  const [showOrgDetailsModal, setShowOrgDetailsModal] = useState<boolean>(false);
  const [editOrgID, setEditOrgID] = useState<string>("");

  const getOrganizations = useCallback(async () => {
    try {
      const orgsRes = await axios.get("/orgs");
      if (!orgsRes.data.err) {
        if (orgsRes.data.orgs && Array.isArray(orgsRes.data.orgs)) {
          setOrgs(orgsRes.data.orgs);
        }
      } else {
        handleGlobalError(orgsRes.data.errMsg);
      }
      setLoadedData(true);
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    }
  }, [handleGlobalError]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Organizations Manager";
    getOrganizations();
  }, [getOrganizations]);

  function handleEditOrg(orgID: string) {
    setEditOrgID(orgID);
    setShowOrgDetailsModal(true);
  }

  const filteredOrgs = useMemo(() => {
    if (!searchString.trim()) return orgs;
    const q = searchString.toLowerCase();
    return orgs.filter((org) => {
      const haystack = [org.name, org.shortName, org.abbreviation]
        .map((s) => String(s ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [orgs, searchString]);

  const columns = useMemo<ColumnDef<Organization>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Organization Name",
        cell: ({ getValue }) => <strong>{getValue<string>()}</strong>,
      },
      {
        id: "actions",
        header: "Actions",
        size: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="primary"
            icon={<IconEdit size={16} />}
            onClick={() => handleEditOrg(row.original.orgID)}
          >
            Edit Organization Details
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Organizations Manager</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Organizations Manager</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <DataTable<Organization>
          data={filteredOrgs}
          columns={columns}
          loading={!loadedData}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Organizations list"
          emptyState={
            <div className="py-8 text-center">
              <Text>
                <em>No results found.</em>
              </Text>
            </div>
          }
          enablePagination
          pageSize={10}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          toolbar={{
            start: (
              <Input
                name="search"
                label="Search organizations"
                labelClassName="sr-only"
                placeholder="Search results..."
                value={searchString}
                onChange={(e) => setSearchString(e.target.value)}
                className="w-80"
              />
            ),
          }}
        />
      </div>

      <OrgDetailsModal
        show={showOrgDetailsModal}
        onClose={() => setShowOrgDetailsModal(false)}
        orgID={editOrgID}
      />
    </div>
  );
};

export default OrganizationsManager;
