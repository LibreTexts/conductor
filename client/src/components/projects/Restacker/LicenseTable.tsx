import React from "react";
import type { ColumnDef } from "@libretexts/davis-react-table";
import RowHeaderDataTable from "../../util/RowHeaderDataTable";

/** Column whose cells name each row; rendered as programmatic row headers. */
export const ROW_HEADER_COLUMN_ID = "title";

interface LicenseTableProps<TData extends { id: string }> {
  data: TData[];
  // TanStack column defs mix accessor value types, hence `any` (same as DataTable's own prop).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  caption: string;
}

/**
 * The Restacker license table. The Page Title column is exposed as row
 * headers, so screen readers announce the page title as context for every
 * control in the row (see RowHeaderDataTable).
 */
function LicenseTable<TData extends { id: string }>({
  data,
  columns,
  caption,
}: LicenseTableProps<TData>) {
  return (
    <RowHeaderDataTable<TData>
      data={data}
      columns={columns}
      caption={caption}
      rowHeaderColumnId={ROW_HEADER_COLUMN_ID}
      getRowId={(row) => row.id}
    />
  );
}

export default LicenseTable;
