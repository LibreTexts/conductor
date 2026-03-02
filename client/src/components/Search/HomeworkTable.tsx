import { Header, Table, TableProps } from "semantic-ui-react";
import type { Homework } from "../../types";
import { truncateString } from "../util/HelperFunctions";

interface HomeworkTableProps extends TableProps {
  items: Homework[];
  loading?: boolean;
  onItemClick: (homework: Homework) => void;
}

const HomeworkTable: React.FC<HomeworkTableProps> = ({
  items,
  loading,
  onItemClick,
  ...rest
}) => {
  return (
    <Table celled title="Homework Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={6} scope="col">
            <Header sub>Name</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={10} scope="col">
            <Header sub>Description</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, index) => {
            return (
              <Table.Row key={index}>
                <Table.Cell>
                  <p
                    onClick={() => onItemClick(item)}
                    className="text-link"
                    tabIndex={0}
                  >
                    <strong>{item.title}</strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>{truncateString(item.description, 250)}</p>
                </Table.Cell>
              </Table.Row>
            );
          })}
        {loading && (
          <Table.Row>
            <Table.Cell colSpan={2}>
              <p className="text-center">
                <em>Loading...</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
        {items.length === 0 && !loading && (
          <Table.Row>
            <Table.Cell colSpan={2}>
              <p className="text-center">
                <em>No results found.</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
};

export default HomeworkTable;
