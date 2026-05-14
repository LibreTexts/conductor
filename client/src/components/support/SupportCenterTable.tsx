import classNames from "classnames";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { Spinner } from "@libretexts/davis-react";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { NestedKeyOf } from "../../types";
import { getNestedProperty } from "../../utils/misc";
import CopyButton from "../util/CopyButton";
import { useNotifications } from "../../context/NotificationContext";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SupportCenterTableProps<T = Record<string, unknown>> {
  loading?: boolean;
  /** @deprecated use className on the wrapper instead */
  tableProps?: { className?: string };
  tableClassName?: string;
  data?: T[];
  noDataText?: string;
  onRowClick?: (record: T) => void;
  columns?: {
    accessor: NestedKeyOf<T>;
    title?: React.ReactNode;
    render?: (record: T, index: number) => React.ReactNode;
    className?: string;
    copyButton?: boolean;
  }[];
  className?: string;
  estimatedRowHeight?: number;
  enableVirtualization?: boolean;
  maxHeight?: string;
}

function SupportCenterTable<T>({
  loading = false,
  tableProps,
  tableClassName,
  data = [],
  noDataText = "No records found",
  onRowClick,
  columns = [],
  className = "",
  estimatedRowHeight = 50,
  enableVirtualization = false,
  maxHeight = "600px",
}: SupportCenterTableProps<T>) {
  const { addNotification } = useNotifications();
  const parentRef = useRef<HTMLDivElement>(null);
  const mergedTableClassName = tableClassName ?? tableProps?.className ?? "";

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight || 50,
    enabled: enableVirtualization,
    overscan: 10,
  });

  const renderCellContent = (column: any, record: T, index: number) => {
    const cellValue = column.render
      ? column.render(record, index)
      : (getNestedProperty(record, column.accessor) as React.ReactNode);

    if (!column.copyButton) return cellValue;

    const copyValue = String(getNestedProperty(record, column.accessor) || "");

    return (
      <div className="flex items-center gap-1">
        <span>{cellValue}</span>
        <CopyButton val={copyValue}>
          {({ copied, copy }) => (
            <button
              type="button"
              className="cursor-pointer text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                copy();
                addNotification({
                  message: "Copied to clipboard",
                  type: "success",
                  duration: 2000,
                });
              }}
              aria-label="Copy to clipboard"
            >
              {copied
                ? <IconCheck size={16} className="text-green-600" />
                : <IconCopy size={16} />}
            </button>
          )}
        </CopyButton>
      </div>
    );
  };

  if (!enableVirtualization) {
    return (
      <div className={classNames("w-full overflow-x-auto", className)}>
        <table
          className={classNames(
            "w-full text-sm border-collapse mt-2",
            mergedTableClassName
          )}
        >
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left font-semibold text-gray-800 whitespace-nowrap border-r border-gray-200 last:border-r-0"
                >
                  {column.title ??
                    capitalizeFirstLetter(column.accessor.toString())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="text-center py-8">
                  <div className="flex justify-center">
                    <Spinner size="md" />
                  </div>
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-gray-500"
                >
                  {noDataText}
                </td>
              </tr>
            )}
            {!loading &&
              data.map((record, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(record)}
                  className={classNames(
                    "border-b border-gray-200",
                    idx % 2 !== 0 ? "bg-gray-50" : "bg-white",
                    onRowClick && "cursor-pointer hover:bg-gray-100 transition-colors"
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.accessor?.toString() || index}
                      className={classNames(
                        "px-4 py-3 whitespace-nowrap max-w-80 truncate border-r border-gray-200 last:border-r-0",
                        column.className
                      )}
                    >
                      {renderCellContent(column, record, index)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const columnWidth = `${100 / columns.length}%`;

  return (
    <div
      className={classNames(
        "w-full border border-gray-200 rounded-lg overflow-hidden",
        className
      )}
    >
      <div className="bg-gray-50 border-b-2 border-gray-300">
        <div className="flex">
          {columns.map((column, index) => (
            <div
              key={index}
              className="px-4 py-3 text-left font-semibold text-gray-800 whitespace-nowrap border-r border-gray-200"
              style={{ width: `calc(${columnWidth} - 1px)` }}
            >
              {column.title ??
                capitalizeFirstLetter(column.accessor.toString())}
            </div>
          ))}
        </div>
      </div>
      <div
        ref={parentRef}
        className="overflow-auto bg-white"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="md" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{noDataText}</div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const record = data[virtualRow.index];
              const isEven = virtualRow.index % 2 === 0;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  onClick={() => onRowClick?.(record)}
                  className={classNames(
                    "absolute top-0 left-0 w-full flex border-b border-gray-200",
                    onRowClick && "cursor-pointer hover:bg-gray-200 transition-colors",
                    isEven ? "bg-white" : "bg-gray-50"
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {columns.map((column, index) => (
                    <div
                      key={column.accessor?.toString() || index}
                      className={classNames(
                        "px-4 py-3 text-gray-900 whitespace-nowrap max-w-120 truncate border-r border-gray-200 tracking-wide",
                        column.className
                      )}
                      style={{ width: columnWidth }}
                    >
                      {renderCellContent(column, record, index)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupportCenterTable;
