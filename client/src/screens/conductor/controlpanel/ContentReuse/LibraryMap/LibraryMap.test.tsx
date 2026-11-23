import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryMap } from "../../../../../types/ContentSources";
import LibraryMapPage from "./index";

const api = vi.hoisted(() => ({ getProvenanceMap: vi.fn() }));
vi.mock("../../../../../api", () => ({ default: api }));
vi.mock("../../../../../state/hooks", () => ({
  useTypedSelector: (select: (s: unknown) => unknown) =>
    select({ user: { uuid: "u1", isSuperAdmin: true, isSupport: false } }),
}));
vi.mock("../../../../../hooks/useDocumentTitle", () => ({ default: () => undefined }));

const totals = (pages: number) => ({
  pages, original: pages - 7, transclude: 7, fork: 0, full: 0, mixed: 0, structural: 0, unknown: 0, viaChain: 0,
});

const map: LibraryMap = {
  nodes: [
    {
      id: "bio-2", kind: "book", lib: "bio", title: "Biology", scanned: true, computedAt: "2026-11-01T00:00:00.000Z",
      totals: totals(50), reusedBy: 0, reuses: 7, attention: { sourceChanged: 1, broken: 0 }, projectID: "P1",
    },
    {
      id: "chem-1", kind: "book", lib: "chem", title: "General Chemistry", scanned: true, computedAt: "2026-11-01T00:00:00.000Z",
      totals: totals(100), reusedBy: 7, reuses: 0, attention: { sourceChanged: 0, broken: 0 }, projectID: null,
    },
    {
      id: "math-3", kind: "book", lib: "math", title: "Calculus", scanned: false, computedAt: null,
      totals: null, reusedBy: 0, reuses: 0, attention: { sourceChanged: 0, broken: 0 }, projectID: null,
    },
  ],
  // General Chemistry → Biology, 7 pages, Copy-Transclude from another library.
  edges: [[1, 0, 7, 1 << 1]],
  edgeTypes: ["transclude-same", "transclude-cross", "section", "fork", "full", "excerpt"],
  libraries: [
    { lib: "bio", books: 1, scanned: 1, phase: "idle", lastCompletedAt: null },
    { lib: "chem", books: 1, scanned: 1, phase: "idle", lastCompletedAt: null },
    { lib: "math", books: 1, scanned: 0, phase: null, lastCompletedAt: null },
  ],
  generatedAt: "2026-11-03T00:00:00.000Z",
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LibraryMapPage />
    </QueryClientProvider>,
  );

describe("LibraryMapPage", () => {
  beforeAll(() => {
    // jsdom has no canvas; the drawing is checked by rendering in a browser.
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
  });
  beforeEach(() => {
    api.getProvenanceMap.mockReset();
    api.getProvenanceMap.mockResolvedValue({ err: false, data: map });
  });

  it("draws every book and says what the map holds", async () => {
    renderPage();
    expect(
      await screen.findByRole("img", {
        name: /^Library map: 3 books in 3 libraries, 2 scanned\. 1 reuse link joins 2 books into 1 coloured neighbourhood\./,
      }),
    ).toBeTruthy();
    // The neighbourhood is named by its most common library and most reused book.
    expect(screen.getByText(/· General Chemistry/)).toBeTruthy();
    expect(screen.getByText(/2 of 3 books scanned so far/)).toBeTruthy();
  });

  it("finds a book by title and opens everything known about it", async () => {
    renderPage();
    await screen.findByRole("img", { name: /^Library map:/ });
    await userEvent.type(screen.getByRole("combobox", { name: "Find a book" }), "Bio");
    await userEvent.click(await screen.findByRole("option", { name: /Biology/ }));

    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Biology")).toBeTruthy();
    expect(within(panel).getByText(/Needs attention: 1 page with a changed source/)).toBeTruthy();
    const sources = within(panel).getByRole("heading", { name: "Takes content from" }).parentElement as HTMLElement;
    expect(within(sources).getByRole("button", { name: "General Chemistry" })).toBeTruthy();
    expect(within(sources).getByText(/7 pages · Copy-Transclude \(another library\)/)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Open its project's Content Sources" }).getAttribute("href")).toBe(
      "/projects/P1/content-sources",
    );
  });

  it("opens a linked book from the panel", async () => {
    renderPage();
    await screen.findByRole("img", { name: /^Library map:/ });
    await userEvent.type(screen.getByRole("combobox", { name: "Find a book" }), "Bio");
    await userEvent.click(await screen.findByRole("option", { name: /Biology/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "General Chemistry" }));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByRole("heading", { name: "Reused by" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Biology" })).toBeTruthy();
  });

  it("filters the map by a library group or single libraries", async () => {
    renderPage();
    await screen.findByRole("img", { name: /^Library map:/ });

    await userEvent.click(screen.getByRole("button", { name: /Libraries/ }));
    expect(screen.getByRole("group", { name: "Library groups" })).toBeTruthy();
    // Single libraries keep their names and book counts.
    expect(screen.getByRole("option", { name: "Chemistry (1)" })).toBeTruthy();

    await userEvent.click(screen.getByRole("option", { name: /STEM/ }));
    expect(screen.getByRole("option", { name: /STEM/ }).getAttribute("aria-selected")).toBe("true");
    for (const option of within(screen.getByRole("group", { name: "Libraries" })).getAllByRole("option")) {
      expect(option.getAttribute("aria-selected")).toBe("true");
    }

    await userEvent.click(screen.getByRole("option", { name: /All libraries/ }));
    expect(screen.getByRole("option", { name: /All libraries/ }).getAttribute("aria-selected")).toBe("true");
  });
});
