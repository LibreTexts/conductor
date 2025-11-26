import classNames from "classnames";
import { Table, TableProps, Icon } from "semantic-ui-react";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { NestedKeyOf } from "../../types";
import { getNestedProperty } from "../../utils/misc";
import CopyButton from "../util/CopyButton";
import { useNotifications } from "../../context/NotificationContext";
import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SupportCenterTableProps<T = Record<string, unknown>> {
  loading?: boolean;
  tableProps?: TableProps;
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
  tableProps = {},
  data = [],
  noDataText = "No records found",
  onRowClick,
  columns = [],
  className = "",
  estimatedRowHeight = 50,
  enableVirtualization = false,
  maxHeight = "600px",
}: SupportCenterTableProps<T>) {
  const { className: tableClassName, ...restTableProps } = tableProps;
  const { addNotification } = useNotifications();
  const parentRef = useRef<HTMLDivElement>(null);

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

    if (!column.copyButton) {
      return cellValue;
    }

    // If copyButton is enabled, wrap content with copy functionality
    const copyValue = String(getNestedProperty(record, column.accessor) || "");

    return (
      <div className="flex justify-start items-center">
        <span>{cellValue}</span>
        <CopyButton val={copyValue}>
          {({ copied, copy }) => (
            <Icon
              name="copy"
              className="cursor-pointer !ml-2"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation(); // Prevent row click when clicking copy button
                copy();
                addNotification({
                  message: "Copied to clipboard",
                  type: "success",
                  duration: 2000,
                });
              }}
              color={copied ? "green" : "blue"}
            />
          )}
        </CopyButton>
      </div>
    );
  };

  if (!enableVirtualization) {
    return (
      <div className={classNames("w-full overflow-x-auto", className)}>
        <Table
          celled
          className={classNames("mt-2", tableClassName)}
          compact
          striped
          {...restTableProps}
        >
          <Table.Header>
            <Table.Row>
              {columns.map((column, index) => (
                <Table.HeaderCell key={index} className="whitespace-nowrap">
                  {column.title ??
                    capitalizeFirstLetter(column.accessor.toString())}
                </Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!loading &&
              data.length !== 0 &&
              data.map((record, idx) => (
                <Table.Row
                  key={idx}
                  onClick={() => onRowClick?.(record)}
                  className={
                    onRowClick ? "cursor-pointer hover:bg-gray-100" : ""
                  }
                >
                  {columns.map((column, index) => (
                    <Table.Cell
                      key={column.accessor?.toString() || index}
                      className={classNames(
                        "whitespace-nowrap max-w-80 truncate break-words",
                        column.className
                      )}
                    >
                      {renderCellContent(column, record, index)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            {!loading && data.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={columns.length} className="!text-center ">
                  {noDataText}
                </Table.Cell>
              </Table.Row>
            )}
            {loading && (
              <Table.Row className="!h-16">
                <Table.Cell colSpan={columns.length} className="!text-center">
                  <LoadingSpinner fullscreen={false} />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
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
              style={{ width: `calc(${columnWidth} - 1px)` }} // bit of a hack to account for slight border offsets
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
        style={{
          maxHeight: maxHeight,
        }}
      >
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner fullscreen={false} />
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
                    onRowClick &&
                      "cursor-pointer hover:bg-gray-100 transition-colors",
                    isEven ? "bg-white" : "bg-gray-50"
                  )}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
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
