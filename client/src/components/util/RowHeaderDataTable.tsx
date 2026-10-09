import React, { useState } from "react";
import {
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableEmpty,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableHeaderRow,
  DataTablePagination,
  DataTableRoot,
  DataTableRow,
  flexRender,
  getDataTableSlots,
  useDavisTable,
  type ColumnDef,
  type SortingState,
  type TableOptions,
} from "@libretexts/davis-react-table";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
} from "@tabler/icons-react";

interface RowHeaderDataTableProps<TData extends object> {
  data: TData[];
  // TanStack column defs mix accessor value types, hence `any` (as in DataTable).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  /** Column whose cells name each row; rendered with `role="rowheader"`. */
  rowHeaderColumnId: string;
  caption: string;
  getRowId: (row: TData) => string;
  enableSorting?: boolean;
  /** Page size; omit for no pagination. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /**
   * Height cap for the scroll area. Applied only from the `md` breakpoint up,
   * so at high zoom the table grows with the page instead of being squeezed.
   */
  maxHeightClassName?: string;
  tableClassName?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  isRowSelected?: (row: TData) => boolean;
  tableOptions?: Partial<TableOptions<TData>>;
}

/**
 * A Davis data table that exposes one column as programmatic row headers.
 *
 * Davis `DataTable` renders every body cell as a plain `<td>` and its sortable
 * headers as focusable `<th>`s rather than buttons, so this composes the public
 * Davis table primitives instead:
 * - the row-header column's cells carry `role="rowheader"`;
 * - sortable headers contain a real `<button>` (name ends in "sortable") and
 *   the `<th>` carries `aria-sort`, with sort icons at 3:1 contrast or better.
 */
function RowHeaderDataTable<TData extends object>({
  data,
  columns,
  rowHeaderColumnId,
  caption,
  getRowId,
  enableSorting = false,
  pageSize,
  pageSizeOptions,
  maxHeightClassName = "md:max-h-[calc(100vh-280px)]",
  tableClassName = "table-fixed w-full",
  emptyState,
  onRowClick,
  isRowSelected,
  tableOptions,
}: RowHeaderDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useDavisTable<TData>({
    data,
    columns,
    getRowId,
    enableDavisSorting: enableSorting,
    enableDavisPagination: pageSize !== undefined,
    enableSorting,
    ...(pageSize !== undefined
      ? { initialState: { pagination: { pageIndex: 0, pageSize } } }
      : {}),
    ...tableOptions,
    state: { sorting, ...tableOptions?.state },
    onSortingChange: setSorting,
  });
  const slots = getDataTableSlots({
    density: "compact",
    striped: true,
    stickyHeader: true,
    bordered: true,
  });
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <DataTableRoot slots={slots} role="region" aria-label={caption}>
      <div
        className={`w-full overflow-x-auto md:overflow-y-auto ${maxHeightClassName}`}
      >
        <DataTableElement slots={slots} caption={caption} className={tableClassName}>
          <DataTableHeader slots={slots}>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataTableHeaderRow key={headerGroup.id} slots={slots}>
                {headerGroup.headers.map((header) => {
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  const canSort = enableSorting && header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  return (
                    <DataTableHeaderCell
                      key={header.id}
                      slots={slots}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                      className="!py-0 !whitespace-normal"
                      aria-sort={
                        canSort
                          ? direction === "asc"
                            ? "ascending"
                            : direction === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {label}
                          <span className="sr-only">, sortable</span>
                          {direction === "asc" ? (
                            <IconArrowUp size={14} aria-hidden="true" className="text-gray-700" />
                          ) : direction === "desc" ? (
                            <IconArrowDown size={14} aria-hidden="true" className="text-gray-700" />
                          ) : (
                            <IconArrowsSort size={14} aria-hidden="true" className="text-gray-600" />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </DataTableHeaderCell>
                  );
                })}
              </DataTableHeaderRow>
            ))}
          </DataTableHeader>
          <DataTableBody slots={slots}>
            {rows.length === 0 ? (
              <DataTableEmpty slots={slots} colSpan={columnCount}>
                {emptyState}
              </DataTableEmpty>
            ) : (
              rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  slots={slots}
                  interactive={!!onRowClick}
                  selected={isRowSelected?.(row.original) ?? false}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <DataTableCell
                      key={cell.id}
                      slots={slots}
                      role={cell.column.id === rowHeaderColumnId ? "rowheader" : undefined}
                      style={{ width: cell.column.getSize() }}
                      className="!py-0 relative !whitespace-normal min-w-0 break-words"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </DataTableCell>
                  ))}
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTableElement>
      </div>
      {/* Pending Davis fix: unavailable pagination buttons stay in the tab
          order and their default/focus contrast is below 3:1. */}
      {pageSize !== undefined && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </DataTableRoot>
  );
}

export default RowHeaderDataTable;
