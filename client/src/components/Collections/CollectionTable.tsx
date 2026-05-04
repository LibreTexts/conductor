import { Collection, CollectionResource } from "../../types";
import { getLibGlyphAltText, getLibGlyphURL } from "../util/LibraryOptions";
import { Link } from "react-router-dom";
import { isBook as checkIsBook } from "../../utils/typeHelpers";
import { getCollectionHref } from "../util/CollectionHelpers";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
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
    id: "library",
    header: "",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data);
      return (
        <Avatar
          src={getLibGlyphURL(isBook ? data.library : "")}
          alt={getLibGlyphAltText(isBook ? data.library : "")}
          size="xs"
        />
      );
    },
  },
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
    id: "subject",
    header: "Subject",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data);
      return <p>{isBook ? data.subject : ""}</p>;
    },
  },
  {
    id: "author",
    header: "Author",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data);
      return <p>{isBook ? data.author : ""}</p>;
    },
  },
  {
    id: "affiliation",
    header: "Affiliation",
    cell: ({ row }) => {
      const data = getItemData(row.original);
      const isBook = checkIsBook(data);
      return (
        <p>
          <em>{isBook ? data.affiliation : ""}</em>
        </p>
      );
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
    <DataTable<RowItem>
      data={data}
      columns={columns}
      loading={loading}
      density="compact"
    />
  );
};

export default CollectionTable;
