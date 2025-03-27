import classNames from "classnames";
import { Table, TableProps } from "semantic-ui-react";
import LoadingSpinner from "../LoadingSpinner";
import { capitalizeFirstLetter } from "../util/HelperFunctions";

interface SupportCenterTableProps<T = Record<string, unknown>> {
  loading?: boolean;
  tableProps?: TableProps;
  data?: T[];
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
          data.map((record) => (
            <Table.Row key={crypto.randomUUID()}>
              {columns.map((column, index) => (
                <Table.Cell
                  key={index}
                  className={classNames(
                    "whitespace-nowrap max-w-72 truncate break-words",
                    column.className
                  )}
                >
                  {column.render
                    ? column.render(record, index)
                    : (record[column.accessor] as React.ReactNode)}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        {loading && <LoadingSpinner />}
      </Table.Body>
    </Table>
  );
}

export default SupportCenterTable;
