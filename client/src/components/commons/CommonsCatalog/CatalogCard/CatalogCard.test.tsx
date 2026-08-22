import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CatalogCard from "./index";
import {
  isBook,
  isConductorSearchResponseFile,
} from "../../../../utils/typeHelpers";
import type { Book, ConductorSearchResponseFile } from "../../../../types";

// A book with only the fields server/models/book.ts marks as required. Mongo
// omits unset optional fields, so this is a shape the catalog really receives.
const MINIMAL_BOOK = {
  bookID: "chem-1234",
  title: "Minimal Book",
  library: "chem",
} as unknown as Book;

// jsdom doesn't implement matchMedia; PausableImage queries prefers-reduced-motion.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderCard = (item: any) =>
  render(
    <MemoryRouter>
      <CatalogCard item={item} />
    </MemoryRouter>
  );

describe("isBook", () => {
  it("accepts a book carrying only the model's required fields", () => {
    // Regression: the guard used to require 14 keys, so any book missing an
    // optional field (e.g. libraryTags) fell through to the file card.
    expect(isBook(MINIMAL_BOOK)).toBe(true);
  });

  it("rejects non-books", () => {
    expect(isBook(undefined)).toBe(false);
    expect(isBook({ foo: "bar" })).toBe(false);
    expect(isBook({ bookID: "x", title: "y" })).toBe(false);
  });
});

describe("isConductorSearchResponseFile", () => {
  it("accepts a search response file", () => {
    expect(
      isConductorSearchResponseFile({
        fileID: "f1",
        projectID: "p1",
        storageType: "file",
      })
    ).toBe(true);
  });

  it("rejects books and junk", () => {
    expect(isConductorSearchResponseFile(MINIMAL_BOOK)).toBe(false);
    expect(isConductorSearchResponseFile(null)).toBe(false);
  });
});

describe("CatalogCard", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a minimal book as a book card rather than throwing", () => {
    expect(() => renderCard(MINIMAL_BOOK)).not.toThrow();
    expect(screen.getByText("Minimal Book")).toBeInTheDocument();
  });

  it("renders a file card for a search response file", () => {
    const file = {
      fileID: "f1",
      projectID: "p1",
      storageType: "file",
      name: "Some Asset",
      projectInfo: {},
    } as unknown as ConductorSearchResponseFile;
    expect(() => renderCard(file)).not.toThrow();
    expect(screen.getByText("Some Asset")).toBeInTheDocument();
  });

  it("renders nothing for an unclassifiable item instead of throwing", () => {
    // Previously fell through to FileCardContent and threw
    // "Cannot read properties of undefined (reading 'thumbnail')".
    const { container } = renderCard({ foo: "bar" });
    expect(container).toBeEmptyDOMElement();
    expect(console.warn).toHaveBeenCalled();
  });
});
