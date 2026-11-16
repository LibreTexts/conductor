import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContentReuse from "./index";

const api = vi.hoisted(() => ({
  getProvenanceStats: vi.fn(),
  getProvenanceGraph: vi.fn(),
}));

vi.mock("../../../../api", () => ({ default: api }));
vi.mock("../../../../state/hooks", () => ({
  useTypedSelector: (select: (s: unknown) => unknown) =>
    select({ user: { uuid: "u1", isSuperAdmin: true, isSupport: false } }),
}));
vi.mock("../../../../hooks/useDocumentTitle", () => ({ default: () => undefined }));

const stats = {
  library: "dev",
  books: 1,
  totals: { pages: 43, original: 11, transclude: 3, fork: 0, full: 0, mixed: 5, structural: 24, unknown: 0, viaChain: 0 },
  booksReusing: 0,
  booksReused: 0,
  scan: { phase: "idle", lastRunAt: "2026-11-11T16:15:57.350Z", lastCompletedAt: null, running: false, stats: null },
  brokenLinks: 0,
  feed: { polledAt: "2026-11-16T10:00:00.000Z", gapAt: null, pendingBooks: 2 },
};

const graph = {
  nodes: [
    { id: "dev-9213", lib: "dev", title: "Remixer Book", url: "https://dev.libretexts.org/@go/page/9213", kind: "book", pages: 43, degree: 1 },
    { id: "library:eng", lib: "eng", title: "eng library (books not scanned yet)", url: "https://eng.libretexts.org", kind: "library", pages: null, degree: 1 },
  ],
  edges: [{ source: "library:eng", target: "dev-9213", pages: 2, types: ["transclude-cross"] }],
  omittedEdges: 0,
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ContentReuse />
    </QueryClientProvider>,
  );

describe("ContentReuse", () => {
  beforeEach(() => {
    api.getProvenanceStats.mockReset();
    api.getProvenanceGraph.mockReset();
  });

  it("shows per-library totals and the book graph with its table", async () => {
    api.getProvenanceStats.mockResolvedValue({ err: false, data: { libraries: [stats] } });
    api.getProvenanceGraph.mockResolvedValue({ err: false, data: graph });
    renderPage();

    expect(await screen.findByText("By library")).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "dev" })).toBeTruthy();
    expect(screen.getByText("2 books waiting to be re-read")).toBeTruthy();
    expect(await screen.findByRole("img", { name: /Book connection graph: 2 nodes and 1 reuse link/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Remixer Book/ })).toBeTruthy();
  });

  it("says so when nothing has been scanned", async () => {
    api.getProvenanceStats.mockResolvedValue({ err: false, data: { libraries: [] } });
    api.getProvenanceGraph.mockResolvedValue({ err: false, data: { nodes: [], edges: [], omittedEdges: 0 } });
    renderPage();
    expect(await screen.findByText("Nothing scanned yet")).toBeTruthy();
    expect(await screen.findByText(/No reuse between books has been found/)).toBeTruthy();
  });
});
