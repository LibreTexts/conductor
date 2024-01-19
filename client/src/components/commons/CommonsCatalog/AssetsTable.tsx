import { Header, Table, TableProps } from "semantic-ui-react";
import { ProjectFile } from "../../../types";
import { Link } from "react-router-dom";
import { truncateString } from "../../util/HelperFunctions";
import { getPrettyAuthorsList } from "../../../utils/assetHelpers";

interface AssetsTableProps extends TableProps {
  items: ProjectFile[];
}

const AssetsTable: React.FC<AssetsTableProps> = ({ items, ...rest }) => {
  return (
    <Table celled title="Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col"></Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Name</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Description</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Author</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>License</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Size</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, index) => {
            return (
              <Table.Row key={index}>
                <Table.Cell></Table.Cell>
                <Table.Cell>
                  <p>
                    <strong>
                      <Link to={`/file/${item.fileID}`}>{item.name}</Link>
                    </strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>{truncateString(item.description, 50)}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>{getPrettyAuthorsList(item.authors)}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    {item.license
                      ? `${item.license.name} ${
                          item.license.version
                            ? `(${item.license.version})`
                            : ""
                        }`
                      : "Unknown"}
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <em>{item.size}</em>
                  </p>
                </Table.Cell>
              </Table.Row>
            );
          })}
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

export default AssetsTable;