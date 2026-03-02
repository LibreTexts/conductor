import { Header, Icon, Table, TableProps } from "semantic-ui-react";
import type { ProjectFileWProjectData } from "../../types";
import FileIcon from "../FileIcon";
import RenderAssetTags from "../FilesManager/RenderAssetTags";
import {
  getPrettyAuthorsList,
  fileSizePresentable,
} from "../../utils/assetHelpers";
import { getFilesLicenseText } from "../util/ProjectHelpers";

interface AssetsTableProps extends TableProps {
  items: ProjectFileWProjectData<"title" | "thumbnail">[];
  loading?: boolean;
  onDownloadFile: (file: ProjectFileWProjectData<"title" | "thumbnail">) => void;
}

const AssetsTable: React.FC<AssetsTableProps> = ({
  items,
  loading,
  onDownloadFile,
  ...rest
}) => {
  return (
    <Table celled title="Asset Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col" width={6}>
            <Header sub>Name</Header>
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
          <Table.HeaderCell scope="col">
            <Header sub>Tags</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, index) => {
            return (
              <Table.Row key={index}>
                <Table.Cell>
                  {item.storageType === "folder" ? (
                    <Icon name="folder outline" />
                  ) : (
                    <FileIcon filename={item.name} />
                  )}
                  <a
                    aria-label={`Download ${item.name}`}
                    onClick={() => onDownloadFile(item)}
                    className="text-link"
                  >
                    {item.name}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  <span>
                    {getPrettyAuthorsList(item.primaryAuthor, item.authors)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {item.license && (
                    <span>
                      {getFilesLicenseText(item.license) ?? "Unknown"}
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {item.storageType === "file" &&
                    fileSizePresentable(item.size)}
                </Table.Cell>
                <Table.Cell>
                  <RenderAssetTags file={item} />
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
        {items.length === 0 && !loading && (
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
