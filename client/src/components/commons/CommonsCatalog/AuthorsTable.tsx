import { Author } from "../../../types";
import { truncateString } from "../../util/HelperFunctions";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, DataTableProps } from "@libretexts/davis-react-table";

interface AuthorsTableProps extends DataTableProps<Author> {
  items: Author[];
  loading?: boolean;
}

const columns: ColumnDef<Author>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue, row }) => (
      <a href={`/authors/${row.original._id}`} className="cursor-pointer">
        {truncateString(getValue<string>(), 50)}
      </a>
    ),
  },
  {
    accessorKey: "companyName",
    header: "Institution/Program",
    cell: ({ row }) => {
      const companyName = row.original.companyName;
      const programName = row.original.programName;
      const displayText = companyName || programName || "";
      return <p>{truncateString(displayText, 50)}</p>;
    },
  },
  {
    accessorKey: "nameURL",
    header: "URL",
    cell: ({ getValue }) =>
      getValue<string>() ? (
        <a
          href={getValue<string>()}
          target="_blank"
          rel="noreferrer"
        >
          {truncateString(getValue<string>() || "", 50)}
        </a>
      ) : (
        <p></p>
      ),
  },
];


const AuthorsTable: React.FC<AuthorsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  return (
    <DataTable<Author> data={items} columns={columns} loading={loading} density="compact" />);
};

export default AuthorsTable;
