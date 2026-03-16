import { Header, Table, TableProps } from "semantic-ui-react";
import { Author } from "../../../types";
import { truncateString } from "../../util/HelperFunctions";

interface AuthorsTableProps extends TableProps {
  items: Author[];
  loading?: boolean;
}

const AuthorsTable: React.FC<AuthorsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  return (
    <Table celled title="Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col">
            <Header sub>Name</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Institution/Program</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>URL</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, index) => {
            return (
              <Table.Row key={index}>
                <Table.Cell>
                  <a href={`/authors/${item._id}`} className="cursor-pointer">
                    {truncateString(
                      `${item.name}`,
                      50
                    )}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    {
                      truncateString(item.companyName || item.programName || "", 50)}
                  </p>
                </Table.Cell>
                <Table.Cell>
                  {item.nameURL && (
                    <a href={item.nameURL} target="_blank" rel="noreferrer">
                      {truncateString(item.nameURL, 50)}
                    </a>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        {loading && (
          <Table.Row>
            <Table.Cell colSpan={5}>
              <p className="text-center">
                <em>Loading...</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
        {items.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={5}>
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

export default AuthorsTable;
