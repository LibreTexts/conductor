import { Book } from "../../../types";
import { getLibGlyphURL } from "../../util/LibraryOptions";
import { Link } from "react-router-dom";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, DataTableProps } from "@libretexts/davis-react-table";
import { Avatar } from "@libretexts/davis-react";

interface BooksTableProps extends DataTableProps<Book> {
  items: Book[];
  loading?: boolean;
}

const columns: ColumnDef<Book>[] = [
  {
    "accessorKey": "library",
    "header": "",
    "cell": ({ getValue }) => (
      <Avatar
        src={getLibGlyphURL(getValue<string>())}
        alt="" // Decorative image - keep alt text empty
        size="xs"
      />
    )
  },
  {
    "accessorKey": "title",
    "header": "Title",
    "cell": ({ getValue, row }) => (
      <p>
        <strong>
          <Link to={`/book/${row.original.bookID}`}>{getValue<string>()}</Link>
        </strong>
      </p>
    )
  },
  {
    "accessorKey": "subject",
    "header": "Subject",
  },
  {
    "accessorKey": "author",
    "header": "Author",
  },
  {
    "accessorKey": "affiliation",
    "header": "Affiliation",
  }
]

const BooksTable: React.FC<BooksTableProps> = ({
  items,
  loading,
  ...rest
}) => {

  return (
    <DataTable<Book> data={items} columns={columns} loading={loading} density="compact" />
  )
};

export default BooksTable;
