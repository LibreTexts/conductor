import classNames from "classnames";
import { Table, TableProps, Icon } from "semantic-ui-react";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { NestedKeyOf } from "../../types";
import { getNestedProperty } from "../../utils/misc";
import CopyButton from "../util/CopyButton";
import { useNotifications } from "../../context/NotificationContext";

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
}

function SupportCenterTable<T>({
  loading = false,
  tableProps = {},
  data = [],
  noDataText = "No records found",
  onRowClick,
  columns = [],
  className = "",
}: SupportCenterTableProps<T>) {
  const { className: tableClassName, ...restTableProps } = tableProps;
  const { addNotification } = useNotifications();

  const renderCellContent = (column: any, record: T, index: number) => {
    const cellValue = column.render
      ? column.render(record, index)
      : (getNestedProperty(record, column.accessor) as React.ReactNode);

    if (!column.copyButton) {
      return cellValue;
    }

    // If copyButton is enabled, wrap content with copy functionality
    const copyValue = String(getNestedProperty(record, column.accessor) || '');

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
            data.map((record) => (
              <Table.Row
                key={crypto.randomUUID()}
                onClick={() => onRowClick?.(record)}
                className={onRowClick ? "cursor-pointer hover:bg-gray-100" : ""}
              >
                {columns.map((column, index) => (
                  <Table.Cell
                    key={index}
                    className={classNames(
                      "whitespace-nowrap max-w-72 truncate break-words",
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
          {/* Loading spinner */}
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

export default SupportCenterTable;