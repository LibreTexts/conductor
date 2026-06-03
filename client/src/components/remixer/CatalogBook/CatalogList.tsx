import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataTable,
  type ColumnDef,
  type RowSelectionState,
} from "@libretexts/davis-react-table";
import { Book } from "../../../types";
import { getLibraryName } from "../../util/LibraryOptions";
import { getLicenseText } from "../../util/LicenseOptions";
import { Button, Input, Modal, Stack } from "@libretexts/davis-react";
import { IconSearch } from "@tabler/icons-react";

const truncateCellClass = "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap";

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
  dimmer,
  catalogBook,
  loadSelectedBook,
  loading = false,
}: CatalogListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const handleRowClick = useCallback((book: Book) => {
    setRowSelection({ [book.bookID]: true });
  }, []);

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

  const columns = useMemo<ColumnDef<Book>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 280,
        minSize: 120,
        cell: ({ row }) => (
          <span className="block whitespace-normal break-words leading-snug">
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: "bookID",
        header: "ID",
        size: 96,
        minSize: 72,
        cell: ({ row }) => (
          <span
            className={truncateCellClass}
            title={row.original.bookID}
          >
            {row.original.bookID}
          </span>
        ),
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
        cell: ({ row }) => {
          const label = getLibraryName(row.original.library);
          return (
            <span className={truncateCellClass} title={label}>
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "author",
        header: "Author",
        size: 180,
        minSize: 100,
        cell: ({ row }) => (
          <span
            className={truncateCellClass}
            title={row.original.author ?? ""}
          >
            {row.original.author}
          </span>
        ),
      },
      {
        accessorKey: "course",
        header: "Campus",
        size: 160,
        minSize: 100,
        cell: ({ row }) => (
          <span
            className={truncateCellClass}
            title={row.original.course ?? ""}
          >
            {row.original.course}
          </span>
        ),
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
        cell: ({ row }) => {
          const label = getLicenseText(row.original.license) ?? "";
          return (
            <span className={truncateCellClass} title={label}>
              {label}
            </span>
          );
        },
      },
    ],
    [],
  );

  useEffect(() => {
    setRowSelection({});
  }, [searchTerm, catalogBook]);

  useEffect(() => {
    const selectedId = Object.keys(rowSelection).find((id) => rowSelection[id]);
    if (!selectedId) {
      setSelectedBook(null);
      return;
    }
    const book = filteredCatalogBook.find((b) => b.bookID === selectedId);
    if (!book) {
      setSelectedBook(null);
      setRowSelection({});
      return;
    }
    setSelectedBook(book);
  }, [rowSelection, filteredCatalogBook]);

  return (
    <Modal open={open} size="xl" onClose={onClose}>
      <Modal.Header>Catalog Book</Modal.Header>
      <Modal.Body >
        <Input
          name="search"
          label=""
          leftIcon={<IconSearch size={16} />}
          placeholder="Search by title, ID, library, author, course, or license…"
          value={searchTerm}
          onChange={(value) => setSearchTerm(value.target.value ?? "")}
          style={{ marginBottom: 12 }}
        />

        <DataTable<Book>
          data={filteredCatalogBook}
          columns={columns}
          caption="Catalog books"
          enableSorting
          enablePagination
          pageSize={10}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          density="compact"
          striped
          bordered
          maxHeight="min(55vh, 420px)"
          stickyHeader
          classNames={{
            table: "w-full min-w-[640px] table-fixed",

          }}
          emptyState="No books match your search."
          enableRowSelection
          onRowClick={handleRowClick}
          enableMultiSort
          enableColumnFilters
          tableOptions={{
            getRowId: (row) => row.bookID,
            enableMultiRowSelection: false,
            state: { rowSelection },
            onRowSelectionChange: setRowSelection,
          }}
        />

      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          <Button onClick={onClose} disabled={loading} variant="outline" className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200">
            Close
          </Button>
          <Button
            variant="primary"
            className="bg-primary text-white hover:bg-primary-dark"
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
          </Button></Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default CatalogList;
