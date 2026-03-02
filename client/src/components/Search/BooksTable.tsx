import { Header, Image, Table, TableProps } from "semantic-ui-react";
import { Link } from "react-router-dom";
import type { Book } from "../../types";
import {
  getLibGlyphURL,
  getLibGlyphAltText,
} from "../util/LibraryOptions";

interface BooksTableProps extends TableProps {
  items: Book[];
  loading?: boolean;
}

const BooksTable: React.FC<BooksTableProps> = ({ items, loading, ...rest }) => {
  return (
    <Table celled title="Book Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell scope="col">
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
        {items.length > 0 &&
          items.map((item, index) => {
            return (
              <Table.Row key={index}>
                <Table.Cell>
                  <Image
                    centered
                    src={getLibGlyphURL(item.library)}
                    className="commons-itemized-glyph"
                    alt={getLibGlyphAltText(item.library)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <strong>
                      <Link
                        to={`/book/${item.bookID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </Link>
                    </strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>{item.subject}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>{item.author}</p>
                </Table.Cell>
                <Table.Cell>
                  <p>
                    <em>{item.affiliation}</em>
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

export default BooksTable;
