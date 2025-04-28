import classNames from "classnames";
import { Table, TableProps } from "semantic-ui-react";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";

interface SupportCenterTableProps<T = Record<string, unknown>> {
  loading?: boolean;
  tableProps?: TableProps;
  data?: T[];
  noDataText?: string;
  onRowClick?: (record: T) => void;
  columns?: {
    accessor: keyof T;
    title?: React.ReactNode;
    render?: (record: T, index: number) => React.ReactNode;
    className?: string;
  }[];
}

function SupportCenterTable<T>({
  loading = false,
  tableProps = {},
  data = [],
  noDataText = "No records found",
  onRowClick,
  columns = [],
}: SupportCenterTableProps<T>) {
  const { className: tableClassName, ...restTableProps } = tableProps;

  return (
    <Table
      celled
      className={classNames("mt-2", tableClassName)}
      compact
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
            <Table.Row key={crypto.randomUUID()} onClick={() => onRowClick?.(record)} className={onRowClick ? "cursor-pointer hover:bg-gray-100" : ""}>
              {columns.map((column, index) => (
                <Table.Cell
                  key={index}
                  className={classNames(
                    "whitespace-nowrap max-w-72 truncate break-words",
                    column.className,
                  )}
                >
                  {column.render
                    ? column.render(record, index)
                    : (record[column.accessor] as React.ReactNode)}
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
        {loading && <LoadingSpinner />}
      </Table.Body>
    </Table>
  );
}

export default SupportCenterTable;
