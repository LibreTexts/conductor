import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Table } from "semantic-ui-react";
import { Book } from "../../../types";
import { PaginationWithItemsSelect } from "../../util/PaginationWithItemsSelect";
import { getLibraryName } from "../../util/LibraryOptions";
import { getLicenseText } from "../../util/LicenseOptions";

const truncateStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

interface CatalogListProps {
  open: boolean;
  onClose: () => void;
  dimmer: string;
  catalogBook?: Book[];
  loadSelectedBook: (bookID: string, library: string, url: string) => void | Promise<void>;
  loading?: boolean;
}

type SortableColumn = "title" | "bookID" | "library" | "author" | "course" | "license";
type SortDirection = "ascending" | "descending";

const CatalogList: React.FC<CatalogListProps> = ({
  open,
  onClose,
  dimmer,
  catalogBook,
  loadSelectedBook,
  loading = false,
}: CatalogListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) =>
        prev === "ascending" ? "descending" : "ascending",
      );
    } else {
      setSortColumn(column);
      setSortDirection("ascending");
    }
    setActivePage(1);
  };

  const filteredCatalogBook = useMemo(() => {
    const books = catalogBook ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return books;
    return books.filter((book) => {
      const haystack = [
        book.title,
        book.bookID,
        book.library,
        getLibraryName(book.library),
        book.author,
        book.course,
        book.license,
        getLicenseText(book.license),
      ]
        .map((s) => (s ?? "").toString().toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [catalogBook, searchTerm]);

  const sortedBooks = useMemo(() => {
    if (!sortColumn) return filteredCatalogBook;
    const sorted = [...filteredCatalogBook].sort((a, b) => {
      const rawA = (a[sortColumn] ?? "").toString();
      const rawB = (b[sortColumn] ?? "").toString();
      const resolve = (raw: string) => {
        if (sortColumn === "library") return getLibraryName(raw);
        if (sortColumn === "license") return getLicenseText(raw) ?? raw;
        return raw;
      };
      const aVal = resolve(rawA).toLowerCase();
      const bVal = resolve(rawB).toLowerCase();
      return aVal.localeCompare(bVal);
    });
    return sortDirection === "descending" ? sorted.reverse() : sorted;
  }, [filteredCatalogBook, sortColumn, sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedBooks.length / itemsPerPage) || 1,
  );

  const paginatedBooks = useMemo(() => {
    const start = (activePage - 1) * itemsPerPage;
    return sortedBooks.slice(start, start + itemsPerPage);
  }, [sortedBooks, activePage, itemsPerPage]);

  useEffect(() => {
    setActivePage(1);
  }, [searchTerm, catalogBook]);

  useEffect(() => {
    if (activePage > totalPages) {
      setActivePage(totalPages);
    }
  }, [activePage, totalPages]);

  return (
    <Modal open={open}  dimmer={dimmer} size="large" >
      <Modal.Header>Catalog Book</Modal.Header>
      <Modal.Content scrolling>
        <Input
          fluid
          icon="search"
          placeholder="Search by title, ID, library, author, course, or license…"
          value={searchTerm}
          onChange={(_e, { value }) => setSearchTerm(value)}
          style={{ marginBottom: 12 }}
        />
        <PaginationWithItemsSelect
          itemsPerPage={itemsPerPage}
          setItemsPerPageFn={(n: number) => {
            setItemsPerPage(n);
            setActivePage(1);
          }}
          activePage={activePage}
          setActivePageFn={setActivePage}
          totalPages={totalPages}
          totalLength={sortedBooks.length}
        />
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <Table celled compact selectable striped sortable style={{ tableLayout: "fixed", width: "100%" }}>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell
                  style={{ width: "30%" }}
                  sorted={sortColumn === "title" ? sortDirection : undefined}
                  onClick={() => handleSort("title")}
                >
                  Title
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ width: "10%" }}
                  sorted={sortColumn === "bookID" ? sortDirection : undefined}
                  onClick={() => handleSort("bookID")}
                >
                  ID
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ width: "12%" }}
                  sorted={sortColumn === "library" ? sortDirection : undefined}
                  onClick={() => handleSort("library")}
                >
                  Library
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ width: "20%" }}
                  sorted={sortColumn === "author" ? sortDirection : undefined}
                  onClick={() => handleSort("author")}
                >
                  Author
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ width: "18%" }}
                  sorted={sortColumn === "course" ? sortDirection : undefined}
                  onClick={() => handleSort("course")}
                >
                  Campus
                </Table.HeaderCell>
                <Table.HeaderCell
                  style={{ width: "10%" }}
                  sorted={sortColumn === "license" ? sortDirection : undefined}
                  onClick={() => handleSort("license")}
                >
                  License
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginatedBooks.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6} textAlign="center">
                    No books match your search.
                  </Table.Cell>
                </Table.Row>
              ) : (
                paginatedBooks.map((book) => {
                  const isSelected = selectedBook?.bookID === book.bookID;
                  return (
                    <Table.Row
                      key={book.bookID}
                      active={isSelected}
                      onClick={() => setSelectedBook(book)}
                      style={{ cursor: "pointer" }}
                    >
                      <Table.Cell style={{ wordBreak: "break-word" }}>
                        {book.title}
                      </Table.Cell>
                      <Table.Cell style={truncateStyle}>{book.bookID}</Table.Cell>
                      <Table.Cell style={truncateStyle} title={getLibraryName(book.library)}>
                        {getLibraryName(book.library)}
                      </Table.Cell>
                      <Table.Cell style={truncateStyle} title={book.author ?? ""}>
                        {book.author}
                      </Table.Cell>
                      <Table.Cell style={truncateStyle} title={book.course ?? ""}>
                        {book.course}
                      </Table.Cell>
                      <Table.Cell style={truncateStyle} title={getLicenseText(book.license) ?? ""}>
                        {getLicenseText(book.license)}
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} disabled={loading}>Close</Button>
        <Button
          loading={loading}
          disabled={!selectedBook || loading}
          onClick={() => loadSelectedBook(selectedBook?.bookID ?? "", selectedBook?.library ?? "", selectedBook?.links?.online ?? "")}
        >
          Load on Library
        </Button>

      </Modal.Actions>
    </Modal>
  );
};

export default CatalogList;
