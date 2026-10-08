import React from "react";
import {
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableHeaderRow,
  DataTableRoot,
  DataTableRow,
  flexRender,
  getDataTableSlots,
  useDavisTable,
  type ColumnDef,
} from "@libretexts/davis-react-table";

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
 * The Restacker license table, composed from the Davis DataTable primitives.
 * `DataTable` renders every body cell as a plain `<td>`, so it can't mark the
 * Page Title column as row headers; composing the primitives lets that cell
 * carry `role="rowheader"`, which gives screen readers the page title as
 * context for every control in the row.
 */
function LicenseTable<TData extends { id: string }>({
  data,
  columns,
  caption,
}: LicenseTableProps<TData>) {
  const table = useDavisTable<TData>({
    data,
    columns,
    getRowId: (row) => row.id,
  });
  const slots = getDataTableSlots({
    density: "compact",
    striped: true,
    stickyHeader: true,
    bordered: true,
  });

  return (
    <DataTableRoot slots={slots} role="region" aria-label={caption}>
      {/* Height cap only from md up: at 200–400% zoom a viewport-based cap
          squeezes the table to a sliver, so small viewports let it grow and
          scroll with the page (horizontal overflow stays inside the table). */}
      <div className="w-full overflow-x-auto md:max-h-[calc(100vh-280px)] md:overflow-y-auto">
        <DataTableElement
          slots={slots}
          caption={caption}
          className="table-fixed w-full"
        >
          <DataTableHeader slots={slots}>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataTableHeaderRow key={headerGroup.id} slots={slots}>
                {headerGroup.headers.map((header) => (
                  <DataTableHeaderCell
                    key={header.id}
                    slots={slots}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize() }}
                    className="!py-0 !whitespace-normal"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </DataTableHeaderCell>
                ))}
              </DataTableHeaderRow>
            ))}
          </DataTableHeader>
          <DataTableBody slots={slots}>
            {table.getRowModel().rows.map((row) => (
              <DataTableRow key={row.id} slots={slots}>
                {row.getVisibleCells().map((cell) => (
                  <DataTableCell
                    key={cell.id}
                    slots={slots}
                    role={
                      cell.column.id === ROW_HEADER_COLUMN_ID
                        ? "rowheader"
                        : undefined
                    }
                    style={{ width: cell.column.getSize() }}
                    className="!py-0 relative !whitespace-normal min-w-0 break-words"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </DataTableCell>
                ))}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTableElement>
      </div>
    </DataTableRoot>
  );
}

export default LicenseTable;
