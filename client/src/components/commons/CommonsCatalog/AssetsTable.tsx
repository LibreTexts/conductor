import { Header, Icon, Table, TableProps } from "semantic-ui-react";
import { ConductorSearchResponseFile } from "../../../types";
import { Link } from "react-router-dom";
import { truncateString } from "../../util/HelperFunctions";
import {
  downloadFile,
  fileSizePresentable,
  getFileTypeIcon,
  getPrettyAuthorsList,
} from "../../../utils/assetHelpers";

interface AssetsTableProps extends TableProps {
  items: ConductorSearchResponseFile[];
  loading?: boolean;
}

const AssetsTable: React.FC<AssetsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  async function handleFileDownload(file: ConductorSearchResponseFile) {
    let success = false;
    try {
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
        //handleGlobalError("Unable to download file. Please try again later.");
      }
    }
  }

  return (
    <Table celled title="Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col">
            <Header sub>Type</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Name</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Description</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Author</Header>
          </Table.HeaderCell>
          <Table.HeaderCell>
            <Header sub>Project</Header>
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
                <Table.Cell>
                  <Icon
                    name={getFileTypeIcon(item)}
                    size="large"
                    color="black"
                  />
                </Table.Cell>
                <Table.Cell>
                  <a
                    onClick={() => handleFileDownload(item)}
                    className="cursor-pointer"
                  >
                    {truncateString(item.name, 50)}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  <p>{truncateString(item.description, 50)}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    {getPrettyAuthorsList(item.primaryAuthor, item.authors)}
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <Link to={`/projects/${item.projectID}`} target="_blank">
                      {truncateString(item.projectInfo?.title, 50)}
                    </Link>
                  </p>
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
                    <em>{fileSizePresentable(item.size)}</em>
                  </p>
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

export default AssetsTable;
