import { Collection, CollectionResource } from "../../types";
import { getLibGlyphAltText, getLibGlyphURL } from "../util/LibraryOptions";
import { Link } from "react-router-dom";
import { isBook as checkIsBook } from "../../utils/typeHelpers";
import { getCollectionHref } from "../util/CollectionHelpers";
import type { ColumnDef } from "@libretexts/davis-react-table";
import AccessibleDataTable from "../commons/AccessibleDataTable";
import { Avatar, Text } from "@libretexts/davis-react";

export interface CollectionTableProps {
  data: Collection[] | CollectionResource[];
  loading: boolean;
}

type RowItem = Collection | CollectionResource;

const getItemData = (item: RowItem) => {
  if ("resourceData" in item) {
    return item.resourceData;
  }
  return item;
};

const columns: ColumnDef<RowItem>[] = [
  {
    id: "title",
    header: "Title",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      return (
        <p>
          <strong>
            <Link to={getCollectionHref(row.original)}>{data.title}</Link>
          </strong>
        </p>
      );
    },
  },
  {
    id: "program",
    header: "Program",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data); // isBook should never be true for strictly Collections records, but need this for type narrowing
      return <p>{isBook ? "" : data.program}</p>;
    },
  },
  {
    id: "resources",
    header: "Number of Resources",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data);
      return <p>{isBook ? "0" : data.resourceCount || "0"}</p>;
    },
  },
];

const CollectionTable: React.FC<CollectionTableProps> = ({ data, loading }) => {
  if (!loading && data.length === 0) {
    return (
      <Text className="text-center" role="alert">
        <em>No results found.</em>
      </Text>
    );
  }

  return (
    <AccessibleDataTable<RowItem>
      data={data}
      columns={columns}
      loading={loading}
      rowHeaderColumnId="title"
      caption="Collection results"
    />
  );
};

export default CollectionTable;
