import { Header, Icon, Image, Popup, Table, TableProps } from "semantic-ui-react";
import type { User } from "../../types";

interface UsersTableProps extends TableProps {
  items: User[];
  loading?: boolean;
}

const UsersTable: React.FC<UsersTableProps> = ({ items, loading, ...rest }) => {
  return (
    <Table celled title="User Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col" width={2}>
            <Header sub>Avatar</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col" width={12}>
            <Header sub>Name</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col" width={2}>
            <Header sub>Info</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, idx) => {
            return (
              <Table.Row key={`user-result-${idx}`}>
                <Table.Cell textAlign="center">
                  <Image avatar src={item.avatar} />
                </Table.Cell>
                <Table.Cell>
                  {item.firstName} {item.lastName}
                </Table.Cell>
                <Table.Cell textAlign="center">
                  <Popup
                    position="left center"
                    trigger={<Icon name="info circle" />}
                    content="More community features coming soon!"
                  />
                </Table.Cell>
              </Table.Row>
            );
          })}
        {loading && (
          <Table.Row>
            <Table.Cell colSpan={3}>
              <p className="text-center">
                <em>Loading...</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
        {items.length === 0 && !loading && (
          <Table.Row>
            <Table.Cell colSpan={3}>
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

export default UsersTable;
