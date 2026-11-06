import {
  Button,
  Input,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookSearchProps, defaultBookSearchProps } from "../model";
import { BookWithAutoMatched } from "../../../../types";
import {
  DataTable,
  createColumnHelper,
} from "@libretexts/davis-react-table";
import { getLibraryName } from "../../../util/LibraryOptions";
import { IconArrowLeft } from "@tabler/icons-react";
import api from "../../../../api";
import TocNode from "./TocNode";

type BookDashboardProps = {
  books: BookWithAutoMatched[];
  projectID: string;
  isLoading?: boolean;
  onAddBookPageAsReference: (data: { bookID: string; pageID: string }) => Promise<boolean>;
};

const SEARCH_INPUT_NAME = "searchQuery";

const columnHelper = createColumnHelper<BookWithAutoMatched>();

const BookDashboard: React.FC<BookDashboardProps> = ({
  books,
  projectID,
  isLoading = false,
  onAddBookPageAsReference,
}) => {
  const [searchQuery, setSearchQuery] = useState<BookSearchProps>(
    defaultBookSearchProps,
  );
  const [selectedBook, setSelectedBook] = useState<BookWithAutoMatched | null>(
    null,
  );
  const bookHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusToSearch = useRef(false);

  // Opening a book replaces the results, and going back replaces the book, so
  // move focus to the new content instead of leaving it on a removed element.
  useEffect(() => {
    if (selectedBook) {
      bookHeadingRef.current?.focus();
    } else if (returnFocusToSearch.current) {
      returnFocusToSearch.current = false;
      document.getElementById(SEARCH_INPUT_NAME)?.focus();
    }
  }, [selectedBook]);

  // Davis DataTable rows respond to clicks only (pending a Davis fix), so the
  // title is also a button to open the book from the keyboard.
  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        size: 280,
        cell: (info) => (
          <button
            type="button"
            className="text-left text-primary underline-offset-2 hover:underline focus-visible:underline"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedBook(info.row.original);
            }}
          >
            {info.getValue() || "Untitled book"}
          </button>
        ),
      }),
      columnHelper.accessor("author", {
        header: "Author",
        size: 160,
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("library", {
        header: "Library",
        size: 120,
        cell: (info) =>
          getLibraryName(info.getValue()) || info.getValue() || "—",
      }),
      columnHelper.accessor("subject", {
        header: "Subject",
        size: 140,
        cell: (info) => info.getValue() || "—",
      }),
    ],
    [],
  );

  const trimmedQuery = searchQuery.searchQuery.trim();
  const showResults = trimmedQuery.length > 0;

  const filteredBooks = useMemo(() => {
    if (!showResults) return [];

    const term = trimmedQuery.toLowerCase();
    return books.filter((book) => {
      if (searchQuery.self && !book.projectID) return false;

      const haystack = [
        book.title,
        book.author,
        book.bookID,
        book.library,
        getLibraryName(book.library),
        book.subject,
        book.affiliation,
        book.course,
      ]
        .map((value) => (value ?? "").toString().toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [books, searchQuery.self, showResults, trimmedQuery]);

  const {
    data: toc,
    isLoading: isLoadingToc,
    isError: isTocError,
  } = useQuery({
    queryKey: ["referenceTOC", projectID, selectedBook?.bookID],
    queryFn: async () => {
      const res = await api.getReferenceTOC(projectID, {
        toc: true,
        bookID: selectedBook!.bookID,
      });
      if (res.err || !res.toc) {
        throw new Error("Failed to load table of contents");
      }
      return res.toc;
    },
    enabled: !!projectID && !!selectedBook?.bookID,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (selectedBook) {
    return (
      <Stack direction="vertical" gap="sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              returnFocusToSearch.current = true;
              setSelectedBook(null);
            }}
          >
            <span className="inline-flex items-center gap-1">
              <IconArrowLeft size={16} aria-hidden="true" />
              Back to search
            </span>
          </Button>
        </div>
        <h3
          ref={bookHeadingRef}
          tabIndex={-1}
          className="text-sm font-semibold focus:outline-none"
        >
          {selectedBook.title}
        </h3>
        <Text size="sm" className="text-neutral-500" id="reference-book-toc-label">
          Table of contents
        </Text>
        {isLoadingToc && (
          <Spinner size="sm" text="Loading table of contents…" />
        )}
        {isTocError && (
          <Text size="sm" className="text-danger" role="alert">
            Could not load the table of contents.
          </Text>
        )}
        {!isLoadingToc && toc && (
          <div className="max-h-[40vh] overflow-y-auto rounded border border-gray-200 p-2">
            <ul className="list-none" aria-labelledby="reference-book-toc-label">
              <TocNode
                node={toc}
                bookID={selectedBook.bookID}
                onAddBookPageAsReference={onAddBookPageAsReference}
              />
            </ul>
          </div>
        )}
      </Stack>
    );
  }

  return (
    <Stack direction="vertical" gap="sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            name={SEARCH_INPUT_NAME}
            label="Search books"
            placeholder="Title, author, or ISBN…"
            value={searchQuery.searchQuery}
            onChange={(e) =>
              setSearchQuery((prev) => ({
                ...prev,
                searchQuery: e.target.value,
              }))
            }
          />
        </div>
        {/* <div className="shrink-0 sm:pb-1">
          <Checkbox
            name="self"
            label="Your books only"
            checked={searchQuery.self}
            onChange={(checked) =>
              setSearchQuery((prev) => ({ ...prev, self: checked }))
            }
          />
        </div> */}
      </div>
      <Text size="sm" className="text-neutral-500">
        Find books to cite
        {searchQuery.self ? " from your books only" : " across LibreTexts"}.
        {!isLoading && ` ${books.length} books available.`}
      </Text>
      {isLoading && <Spinner size="sm" text="Loading books…" />}
      <div role="status" aria-live="polite">
        {!isLoading && showResults && (
          <Text size="sm" className="text-neutral-500">
            {filteredBooks.length === 0
              ? "No books found."
              : `${filteredBooks.length} book${filteredBooks.length === 1 ? "" : "s"} found. Choose a title to see its pages.`}
          </Text>
        )}
      </div>
      {!isLoading && showResults && filteredBooks.length > 0 && (
        <DataTable<BookWithAutoMatched>
          data={filteredBooks}
          columns={columns}
          aria-label="Book search results"
          stickyHeader
          striped
          bordered
          density="compact"
          maxHeight="40vh"
          onRowClick={setSelectedBook}
          tableOptions={{
            getRowId: (row) => row.bookID,
          }}
          classNames={{
            table: "table-fixed w-full",
            cell: "!whitespace-normal min-w-0 break-words",
            row: "cursor-pointer",
          }}
        />
      )}
    </Stack>
  );
};

export default BookDashboard;
