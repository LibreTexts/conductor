import React, { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { Book } from "../../../types";
import { getLibraryName } from "../../util/LibraryOptions";
import { getLicenseText } from "../../util/LicenseOptions";
import { Button, Input, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconSearch } from "@tabler/icons-react";
import RowHeaderDataTable from "../../util/RowHeaderDataTable";

const SELECTION_HINT_ID = "catalog-book-selection-hint";
const ROW_HEADER_COLUMN_ID = "title";

interface CatalogListProps {
  open: boolean;
  onClose: () => void;
  dimmer: string;
  catalogBook?: Book[];
  loadSelectedBook: (bookID: string, library: string, url: string) => void | Promise<void>;
  loading?: boolean;
}

const CatalogList: React.FC<CatalogListProps> = ({
  open,
  onClose,
  catalogBook,
  loadSelectedBook,
  loading = false,
}: CatalogListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBookID, setSelectedBookID] = useState<string | null>(null);

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
        book?.links?.online,
        getLicenseText(book.license),
      ]
        .map((s) => (s ?? "").toString().toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [catalogBook, searchTerm]);

  // A new search or catalog clears a selection that may no longer be listed.
  useEffect(() => {
    setSelectedBookID(null);
  }, [searchTerm, catalogBook]);

  const selectedBook = useMemo(
    () =>
      selectedBookID
        ? (filteredCatalogBook.find((b) => b.bookID === selectedBookID) ?? null)
        : null,
    [selectedBookID, filteredCatalogBook],
  );

  const columns = useMemo<ColumnDef<Book>[]>(
    () => [
      {
        // Only one book can be loaded, so selection uses radio buttons (one
        // group across the table) rather than checkboxes.
        id: "select",
        header: () => <span className="sr-only">Select</span>,
        enableSorting: false,
        size: 48,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="radio"
              name="catalog-book"
              className="size-4 accent-primary"
              aria-label={`Select ${row.original.title}`}
              aria-describedby={SELECTION_HINT_ID}
              checked={selectedBookID === row.original.bookID}
              onChange={() => setSelectedBookID(row.original.bookID)}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ),
      },
      {
        id: ROW_HEADER_COLUMN_ID,
        accessorKey: "title",
        header: "Title",
        size: 280,
        minSize: 120,
        cell: ({ row }) => (
          <span className="block leading-snug">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "bookID",
        header: "ID",
        size: 96,
        minSize: 72,
      },
      {
        accessorKey: "library",
        header: "Library",
        size: 112,
        minSize: 88,
        sortingFn: (rowA, rowB) =>
          getLibraryName(rowA.original.library)
            .toLowerCase()
            .localeCompare(getLibraryName(rowB.original.library).toLowerCase()),
        cell: ({ row }) => getLibraryName(row.original.library),
      },
      {
        accessorKey: "author",
        header: "Author",
        size: 180,
        minSize: 100,
      },
      {
        accessorKey: "course",
        header: "Campus",
        size: 160,
        minSize: 100,
      },
      {
        accessorKey: "license",
        header: "License",
        size: 96,
        minSize: 72,
        sortingFn: (rowA, rowB) => {
          const a = (getLicenseText(rowA.original.license) ?? "").toLowerCase();
          const b = (getLicenseText(rowB.original.license) ?? "").toLowerCase();
          return a.localeCompare(b);
        },
        cell: ({ row }) => getLicenseText(row.original.license) ?? "",
      },
    ],
    [selectedBookID],
  );

  return (
    <Modal open={open} size="xl" onClose={onClose}>
      <Modal.Header>
        <Modal.Title>Catalog Book</Modal.Title>
      </Modal.Header>
      <Modal.Body className="!overflow-visible">
        <Input
          name="search"
          label="Search the catalog"
          labelClassName="sr-only"
          leftIcon={<IconSearch size={16} aria-hidden="true" />}
          placeholder="Search by title, ID, library, author, course, or license…"
          value={searchTerm}
          onChange={(value) => setSearchTerm(value.target.value ?? "")}
          style={{ marginBottom: 12 }}
        />
        <Text as="p" size="sm" id={SELECTION_HINT_ID} className="mb-2 text-gray-700">
          Select one book to load. Only one book can be selected at a time.
        </Text>

        <RowHeaderDataTable<Book>
          data={filteredCatalogBook}
          columns={columns}
          caption="Catalog books"
          rowHeaderColumnId={ROW_HEADER_COLUMN_ID}
          getRowId={(row) => row.bookID}
          enableSorting
          pageSize={10}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          maxHeightClassName="md:max-h-[min(50vh,420px)]"
          tableClassName="w-full min-w-[640px] table-fixed"
          emptyState="No books match your search."
          onRowClick={(book) => setSelectedBookID(book.bookID)}
          isRowSelected={(book) => book.bookID === selectedBookID}
        />
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          {/* Davis "outline" border is below 3:1 (pending Davis fix). */}
          <Button onClick={onClose} disabled={loading} variant="secondary">
            Close
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!selectedBook || loading}
            onClick={() =>
              loadSelectedBook(
                selectedBook?.bookID ?? "",
                selectedBook?.library ?? "",
                selectedBook?.links?.online ?? "",
              )
            }
          >
            Load on Library
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default CatalogList;
