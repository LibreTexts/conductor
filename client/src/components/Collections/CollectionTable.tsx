import { Header, Image, Table } from "semantic-ui-react";
import { Collection, CollectionResource } from "../../types";
import { getLibGlyphAltText, getLibGlyphURL } from "../util/LibraryOptions";
import { Link } from "react-router-dom";
import { isBook as checkIsBook } from "../../utils/typeHelpers";
import { getCollectionHref } from "../util/CollectionHelpers";

export interface CollectionTableProps {
  data: Collection[] | CollectionResource[];
  loading: boolean;
}

const CollectionTable: React.FC<CollectionTableProps> = ({ data, loading }) => {
  const getItemData = (item: Collection | CollectionResource) => {
    if ("resourceData" in item) {
      return item.resourceData;
    } else {
      return item;
    }
  };

  return (
    <Table celled title="Collection Resources">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col" role="columnheader">
            <Image
              centered
              src={getLibGlyphURL("")}
              className="commons-itemized-glyph"
              alt={getLibGlyphAltText("")}
            />
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Title</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Subject</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Author</Header>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">
            <Header sub>Affiliation</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {!loading &&
          data.length > 0 &&
          data.map((i) => {
            const item = getItemData(i);
            const isBook = checkIsBook(item);
            return (
              <Table.Row key={crypto.randomUUID()}>
                <Table.Cell>
                  <Image
                    centered
                    src={getLibGlyphURL(isBook ? item.library : "")}
                    className="commons-itemized-glyph"
                    alt={getLibGlyphAltText(isBook ? item.library : "")}
                  />
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <strong>
                      <Link to={getCollectionHref(i)}>{item.title}</Link>
                    </strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>{isBook ? item.subject : ""}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>{isBook ? item.author : ""}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <em>{isBook ? item.affiliation : ""}</em>
                  </p>
                </Table.Cell>
              </Table.Row>
            );
          })}
        {!loading && data.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={4}>
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

export default CollectionTable;
