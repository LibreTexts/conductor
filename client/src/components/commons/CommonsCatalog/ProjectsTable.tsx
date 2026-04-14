import { Project } from "../../../types";
import { Link } from "react-router-dom";
import { truncateString } from "../../util/HelperFunctions";
import { getClassificationText } from "../../util/ProjectHelpers";
import { format, parseISO } from "date-fns";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, DataTableProps } from "@libretexts/davis-react-table";

interface ProjectsTableProps extends DataTableProps<Project> {
  items: Project[];
  loading?: boolean;
}

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ getValue, row }) => (
      <Link to={`/projects/${row.original.projectID}`}>
        {truncateString(getValue<string>(), 100)}
      </Link>
    ),
  },
  {
    accessorKey: "author",
    header: "Author",
    cell: ({ getValue }) => <p>{truncateString(getValue<string>(), 50)}</p>,
  },
  {
    accessorKey: "currentProgress",
    header: "Progress (C/PR/A11Y)",
    cell: ({ row }) => {
      const item = row.original;
      if (!item.hasOwnProperty("peerProgress")) item.peerProgress = 0;
      if (!item.hasOwnProperty("a11yProgress")) item.a11yProgress = 0;
      return (
        <div className="flex-row-div projectportal-progress-row">
          <div className="projectportal-progress-col">
            <span>{item.currentProgress}%</span>
          </div>
          <div className="projectportal-progresssep-col">
            <span className="projectportal-progresssep">/</span>
          </div>
          <div className="projectportal-progress-col">
            <span>{item.peerProgress}%</span>
          </div>
          <div className="projectportal-progresssep-col">
            <span className="projectportal-progresssep">/</span>
          </div>
          <div className="projectportal-progress-col">
            <span>{item.a11yProgress}%</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "classification",
    header: "Classification",
    cell: ({ getValue }) =>
      getValue<string>() ? <p>{getClassificationText(getValue<string>())}</p> : <p></p>,
  },
  {
    accessorKey: "lastUpdated",
    header: "Last Updated",
    cell: ({ getValue }) =>
      getValue<string>() ? <p>{format(parseISO(getValue<string>()), "MM/dd/yyyy")}</p> : <p></p>,
  },
];


const ProjectsTable: React.FC<ProjectsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  return (
    <DataTable<Project> data={items} columns={columns} loading={loading} density="compact" />);
};

export default ProjectsTable;
