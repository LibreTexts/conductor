import { useState } from "react";
import { Badge, Card, Heading } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";
import { UserActivityAdminRow } from "../../../types";
import { VISIBILITY_BADGES } from "../../../utils/activityHelpers";

interface UserH5PActivitiesProps {
  /** Conductor-local UUID, which activity ownership keys off. */
  uuid: string;
}

const editURL = (activityID: string) => `/h5p/${activityID}/edit`;

const columns: ColumnDef<UserActivityAdminRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    // A real link, so keyboard and screen reader users can open the editor
    // without relying on the row click.
    cell: ({ row }) => (
      <a
        href={editURL(row.original.activityID)}
        target="_blank"
        rel="noreferrer"
        className="line-clamp-1 break-words text-primary-600 underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.title}
      </a>
    ),
  },
  {
    accessorKey: "libraryTitle",
    header: "Content Type",
    cell: ({ getValue }) => getValue<string>() || "Unknown",
  },
  {
    accessorKey: "visibility",
    header: "Visibility",
    cell: ({ row }) => {
      const badge = VISIBILITY_BADGES[row.original.visibility];
      return badge ? <Badge label={badge.label} variant={badge.variant} dot size="sm" /> : null;
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ getValue }) => (getValue<string>() === "owner" ? "Owner" : "Collaborator"),
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
    cell: ({ getValue }) => {
      const value = getValue<string>();
      return value ? format(parseISO(value), "MM/dd/yyyy") : "Unknown";
    },
  },
];

const UserH5PActivities: React.FC<UserH5PActivitiesProps> = ({ uuid }) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isFetching } = useQuery<UserActivityAdminRow[]>({
    queryKey: ["user-activities", uuid, activePage, itemsPerPage],
    queryFn: () => getUserActivities(),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: !!uuid,
  });

  async function getUserActivities() {
    try {
      if (!uuid) return [];
      const res = await api.getUserActivitiesAdmin({
        uuid,
        page: activePage,
        limit: itemsPerPage,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg || "Failed to fetch user H5P activities.");
      }
      if (!Array.isArray(res.data.activities)) {
        throw new Error("Failed to fetch user H5P activities.");
      }
      setTotalItems(res.data.total_items || 0);
      return res.data.activities;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  return (
    <Card>
      <Card.Header>
        <Heading level={3}>H5P Activities</Heading>
      </Card.Header>
      <Card.Body>
        <DataTable<UserActivityAdminRow>
          data={data || []}
          columns={columns}
          loading={isFetching}
          density="compact"
          caption="H5P activities this user owns or collaborates on"
          emptyState="No H5P activities found."
          onRowClick={(record) => window.open(editURL(record.activityID), "_blank")}
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50]}
          tableOptions={{
            manualPagination: true,
            rowCount: totalItems,
            state: { pagination: paginationState },
            onPaginationChange: (updater) => {
              const next =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setActivePage(next.pageIndex + 1);
              setItemsPerPage(next.pageSize);
            },
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default UserH5PActivities;
