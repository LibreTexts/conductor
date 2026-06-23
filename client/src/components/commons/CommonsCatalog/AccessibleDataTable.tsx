import { ReactNode } from "react";
import {
  DataTableRoot,
  DataTableElement,
  DataTableHeader,
  DataTableHeaderRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableEmpty,
  getDataTableSlots,
  useDavisTable,
  flexRender,
} from "@libretexts/davis-react-table";
import type { ColumnDef, DataTableDensity } from "@libretexts/davis-react-table";

interface AccessibleDataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  /**
   * Column id (defaults to the column's accessorKey) whose body cell should be
   * rendered as a row header (`<th scope="row">`) so assistive tech can
   * associate every data cell with the row it belongs to (SC 1.3.1).
   */
  rowHeaderColumnId: string;
  /** Accessible name for the table, rendered as an sr-only <caption>. */
  caption: string;
  loading?: boolean;
  emptyState?: ReactNode;
  density?: DataTableDensity;
}

/**
 * A thin, accessible DataTable composed from Davis's low-level table primitives
 * + `useDavisTable`. Unlike the high-level `<DataTable>` (which renders every
 * body cell as a `<td>`), this emits proper header relationships: column
 * headers carry `scope="col"` and the designated row-header column emits
 * `<th scope="row">`. Use for Commons data tables that the ACR flagged for
 * missing programmatic header relationships.
 */
function AccessibleDataTable<TData>({
  data,
  columns,
  rowHeaderColumnId,
  caption,
  loading,
  emptyState,
  density = "compact",
}: AccessibleDataTableProps<TData>) {
  const table = useDavisTable<TData>({ data, columns });
  // Match the high-level DataTable's defaults so the look is unchanged.
  const slots = getDataTableSlots({ density, striped: true, bordered: true });
  const columnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <DataTableRoot slots={slots} role="region" aria-label={caption}>
      <div className="w-full">
        <DataTableElement slots={slots} caption={caption}>
          <DataTableHeader slots={slots}>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataTableHeaderRow slots={slots} key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  // DataTableHeaderCell already renders <th scope="col">
                  <DataTableHeaderCell
                    slots={slots}
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </DataTableHeaderCell>
                ))}
              </DataTableHeaderRow>
            ))}
          </DataTableHeader>
          <DataTableBody slots={slots}>
            {loading ? (
              <tr>
                <td colSpan={columnCount} className={slots.loadingCell()}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <DataTableEmpty slots={slots} colSpan={columnCount}>
                {emptyState}
              </DataTableEmpty>
            ) : (
              rows.map((row) => (
                <DataTableRow slots={slots} key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const content = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    );
                    // Row-header cell: a <th scope="row"> styled with the same
                    // `cell()` slot so it looks identical to a body <td>.
                    if (cell.column.id === rowHeaderColumnId) {
                      return (
                        <th
                          key={cell.id}
                          scope="row"
                          className={slots.cell()}
                          style={{ width: cell.column.getSize() }}
                        >
                          {content}
                        </th>
                      );
                    }
                    return (
                      <DataTableCell
                        slots={slots}
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                      >
                        {content}
                      </DataTableCell>
                    );
                  })}
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTableElement>
      </div>
    </DataTableRoot>
  );
}

export default AccessibleDataTable;
