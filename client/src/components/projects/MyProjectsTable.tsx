import { useMemo } from "react";
import { Link } from "react-router-dom-v5-compat";
import { useHistory } from "react-router-dom";
import { Text } from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import { truncateString } from "../util/HelperFunctions";
import { Project } from "../../types";
import {
  getClassificationText,
  getVisibilityText,
} from "../util/ProjectHelpers";
import { format, parseISO } from "date-fns";

interface MyProjectsTableProps {
  data: Project[];
  loading?: boolean;
}

const MyProjectsTable: React.FC<MyProjectsTableProps> = ({
  data,
  loading = false,
}) => {
  const history = useHistory();

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        accessorKey: "title",
        cell: ({ row }) => (
          <strong>
            <Link
              to={`/projects/${row.original.projectID}?reviewer=true`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {truncateString(row.original.title, 100)}
            </Link>
          </strong>
        ),
      },
      {
        id: "progress",
        header: "Progress (C/PR/A11Y)",
        cell: ({ row }) => {
          const peerProgress = row.original.peerProgress ?? 0;
          const a11yProgress = row.original.a11yProgress ?? 0;
          return (
            <span className="whitespace-nowrap">
              {row.original.currentProgress}%
              <span className="mx-1 text-gray-400">/</span>
              {peerProgress}%
              <span className="mx-1 text-gray-400">/</span>
              {a11yProgress}%
            </span>
          );
        },
      },
      {
        id: "classification",
        header: "Classification",
        accessorKey: "classification",
        cell: ({ row }) =>
          row.original.classification ? (
            <span>{getClassificationText(row.original.classification)}</span>
          ) : (
            <em className="text-gray-500">Unclassified</em>
          ),
      },
      {
        id: "visibility",
        header: "Visibility",
        accessorKey: "visibility",
        cell: ({ row }) =>
          row.original.visibility ? (
            <span>{getVisibilityText(row.original.visibility)}</span>
          ) : (
            <em className="text-gray-500">Unknown</em>
          ),
      },
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }) => {
          let projectLead = "Unknown";
          if (row.original.leads && Array.isArray(row.original.leads)) {
            row.original.leads.forEach((lead, idx) => {
              if (lead.firstName && lead.lastName) {
                if (idx === 0) projectLead = `${lead.firstName} ${lead.lastName}`;
                else projectLead += `, ${lead.firstName} ${lead.lastName}`;
              }
            });
          }
          return <span>{truncateString(projectLead, 50)}</span>;
        },
      },
      {
        id: "updatedAt",
        header: "Last Updated",
        accessorKey: "updatedAt",
        cell: ({ row }) =>
          row.original.updatedAt ? (
            <span className="whitespace-nowrap">
              {format(parseISO(row.original.updatedAt), "MM/dd/yyyy")} at{" "}
              {format(parseISO(row.original.updatedAt), "hh:mm a")}
            </span>
          ) : null,
      },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={loading}
      density="compact"
      bordered
      striped
      stickyHeader
      caption="My projects list"
      emptyState={
        <div className="py-8 text-center">
          <Text>
            <em>No results found.</em>
          </Text>
        </div>
      }
      onRowClick={(row) =>
        history.push(`/projects/${row.projectID}?reviewer=true`)
      }
    />
  );
};

export default MyProjectsTable;
