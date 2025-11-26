import Fuse from "fuse.js";
import {
  Book,
  BooksManagerSortOptions,
  GenericKeyTextValueObj,
  MasterCatalogV2Response,
} from "../types";
import { z } from "zod";
import { bookIDSchema } from "./misc";
import { isMasterCatalogV2Response } from "./typeHelpers";
import { getLibraryName } from "../components/util/LibraryOptions";

export function filterBooksBySearchTerm<
  T extends MasterCatalogV2Response | Book[]
>(books: T, term: string): T {
  if (!term.trim()) return books;

  const lowerTerm = term.toLowerCase();
  const urlSchema = z.string().url();
  const FUSE_OPTIONS: Partial<typeof Fuse.config> = {
    threshold: 0.3,
    keys: ["title", "author"],
    includeScore: true,
  };

  // Determine if the term is a URL or Book ID
  const isUrl = urlSchema.safeParse(term).success;
  const isBookID =
    lowerTerm.includes("-") && bookIDSchema.safeParse(lowerTerm).success;
  const shouldSearch = !isUrl && !isBookID; // Only use Fuse for general searches

  const flattened = isMasterCatalogV2Response(books)
    ? flattenCatalogResponse(books)
    : (books as Book[]);

  // Set up Fuse and extract results
  const fuseIndex = Fuse.createIndex<Book>(
    FUSE_OPTIONS.keys as string[],
    flattened
  );
  const fuseInstance = new Fuse<Book>(flattened, FUSE_OPTIONS, fuseIndex);

  const fuseResults = shouldSearch
    ? fuseInstance.search(term, { limit: 200 })
    : [];
  const fuseBookIDs = new Set(fuseResults.map((result) => result.item.bookID));

  const matches: Book[] = [];
  for (const book of flattened) {
    if (isUrl) {
      if (
        Object.entries(book.links).some(([_, url]) =>
          url.toLowerCase().endsWith(lowerTerm)
        )
      ) {
        matches.push(book);
      }
      continue; // If searching by URL, skip other checks
    }
    if (isBookID) {
      if (book.bookID.toLowerCase() === lowerTerm) {
        matches.push(book);
      }
      continue; // If searching by Book ID, skip other checks
    }

    if (fuseBookIDs.has(book.bookID)) {
      matches.push(book);
    }
  }

  if (isMasterCatalogV2Response(books)) {
    return filterCatalogResponseByIDs(
      books,
      matches.map((b) => b.bookID)
    ) as T;
  } else {
    return matches as T;
  }
}

export const flattenCatalogResponse = (
  catalog: MasterCatalogV2Response
): Book[] => {
  const books: Book[] = [];
  catalog.libraries.forEach((library) => {
    library.courses.forEach((course) => {
      course.books.forEach((book) => books.push(book));
    });
    library.subjects.forEach((subject) => {
      subject.books.forEach((book) => books.push(book));
    });
  });
  return books;
};

export const filterCatalogResponseByIDs = (
  catalog: MasterCatalogV2Response,
  bookIDs: string[]
): MasterCatalogV2Response => {
  // Create a deep copy to avoid mutations
  const filteredLibraries = catalog.libraries.map((library) => ({
    ...library,
    courses: library.courses
      .map((course) => ({
        ...course,
        books: course.books.filter((book) => bookIDs.includes(book.bookID)),
      }))
      .filter((c) => c.books.length > 0),
    subjects: library.subjects
      .map((subject) => ({
        ...subject,
        books: subject.books.filter((book) => bookIDs.includes(book.bookID)),
      }))
      .filter((s) => s.books.length > 0),
  }));

  return {
    libraries: filteredLibraries.filter(
      (lib) => lib.courses.length > 0 || lib.subjects.length > 0
    ),
  };
};

export function sortBooks<T extends Book[]>(
  books: T,
  sort: BooksManagerSortOptions
): T {
  const booksCopy = [...books] as T;

  switch (sort) {
    case "title_asc":
      return booksCopy.sort((a, b) => a.title.localeCompare(b.title));
    case "title_desc":
      return booksCopy.sort((a, b) => b.title.localeCompare(a.title));
    case "author_asc":
      return booksCopy.sort((a, b) => a.author.localeCompare(b.author));
    case "author_desc":
      return booksCopy.sort((a, b) => b.author.localeCompare(a.author));
    case "book_id_asc":
      return booksCopy.sort((a, b) => a.bookID.localeCompare(b.bookID));
    case "book_id_desc":
      return booksCopy.sort((a, b) => b.bookID.localeCompare(a.bookID));
    case "library_asc":
      return booksCopy.sort((a, b) =>
        getLibraryName(a.library).localeCompare(getLibraryName(b.library))
      );
    case "library_desc": {
      return booksCopy.sort((a, b) =>
        getLibraryName(b.library).localeCompare(getLibraryName(a.library))
      );
    }
    default:
      return booksCopy;
  }
}

export const BOOKS_MANAGER_SORT_OPTIONS: GenericKeyTextValueObj<BooksManagerSortOptions>[] =
  [
    { key: "title_asc", value: "title_asc", text: "Title (A-Z)" },
    { key: "title_desc", value: "title_desc", text: "Title (Z-A)" },
    {
      key: "author_asc",
      value: "author_asc",
      text: "Author (A-Z)",
    },
    {
      key: "author_desc",
      value: "author_desc",
      text: "Author (Z-A)",
    },
    {
      key: "book_id_asc",
      value: "book_id_asc",
      text: "Book ID (A-Z)",
    },
    {
      key: "book_id_desc",
      value: "book_id_desc",
      text: "Book ID (Z-A)",
    },
    {
      key: "library_asc",
      value: "library_asc",
      text: "Library (A-Z)",
    },
    {
      key: "library_desc",
      value: "library_desc",
      text: "Library (Z-A)",
    },
  ];
