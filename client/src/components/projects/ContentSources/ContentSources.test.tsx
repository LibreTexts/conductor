import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContentSources from "./index";
import type { ContentSourcesOverview } from "../../../types/ContentSources";

const api = vi.hoisted(() => ({
  getContentSources: vi.fn(),
  getContentSourcesPages: vi.fn(),
  getContentSourcesLineage: vi.fn(),
  updateContentSourcesNotifications: vi.fn(),
}));

vi.mock("../../../api", () => ({ default: api }));
vi.mock("../../../hooks/useProject", () => ({
  default: () => ({ project: { title: "Test Book Project" }, isLoading: false, isError: false }),
}));
vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));
// Charts need layout APIs jsdom lacks; the numbers are covered by the stat cards.
vi.mock("@tremor/react", () => ({ DonutChart: () => null }));

const ref = (id: string, title: string) => ({
  id,
  lib: id.split("-")[0],
  title,
  url: `https://${id.split("-")[0]}.libretexts.org/@go/page/${id.split("-")[1]}`,
});

const overview = (extra: Partial<ContentSourcesOverview> = {}): ContentSourcesOverview => ({
  bookID: "dev-9213",
  book: ref("dev-9213", "Remixer Book"),
  scanned: true,
  computedAt: "2026-11-11T16:16:10.457Z",
  totals: {
    pages: 43, original: 11, transclude: 3, fork: 0, full: 0,
    mixed: 5, structural: 24, unknown: 0, viaChain: 0,
  },
  upstream: [],
  downstream: [],
  unscannedSources: [
    {
      lib: "eng", pages: 2, sources: 2, types: ["transclude-cross"],
      examples: ["eng-49977"], exampleRefs: [ref("eng-49977", "Lab Experiments")],
    },
  ],
  attention: { sourceChanged: 0, broken: 0 },
  recentChanges: [],
  notifySourceChanges: true,
  canManage: false,
  ...extra,
});

const pageRow = {
  ...ref("dev-10622", "5: Chapters"),
  pageID: 10622,
  kind: "transclude" as const,
  reuseDepth: 1,
  rootSource: null,
  reuseCycle: false,
  sources: [
    { ...ref("dev-8998", "2: Chapters"), type: "transclude-same" as const, origin: "scan" as const, status: "active" as const },
  ],
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/cbHAlG9FKc/content-sources"]}>
        <Route path="/projects/:id/content-sources">
          <ContentSources />
        </Route>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("ContentSources", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getContentSourcesPages.mockResolvedValue({
      err: false,
      data: { total: 1, page: 1, limit: 25, pages: [pageRow] },
    });
    api.getContentSourcesLineage.mockResolvedValue({
      err: false,
      data: {
        page: ref("dev-10622", "5: Chapters"),
        steps: [{
          source: ref("dev-8998", "2: Chapters"),
          target: ref("dev-10622", "5: Chapters"),
          type: "transclude-same", status: "active", hops: 1,
        }],
        truncated: false,
      },
    });
  });

  it("says when the book hasn't been scanned yet", async () => {
    api.getContentSources.mockResolvedValue({
      err: false,
      data: overview({ scanned: false, totals: null, unscannedSources: [] }),
    });
    renderPage();
    expect(await screen.findByText("This book hasn't been scanned yet")).toBeTruthy();
    expect(api.getContentSourcesPages).not.toHaveBeenCalled();
  });

  it("shows the summary, unscanned sources and the pages table", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview() });
    renderPage();
    expect(await screen.findByText("Summary")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lab Experiments/ })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /5: Chapters/ })).toBeTruthy();
  });

  it("warns when reused pages were deleted", async () => {
    api.getContentSources.mockResolvedValue({
      err: false,
      data: overview({ attention: { sourceChanged: 0, broken: 2 } }),
    });
    renderPage();
    expect(await screen.findByText("Some reused pages were deleted")).toBeTruthy();
  });

  it("offers the email switch only to project admins", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview({ canManage: false }) });
    const { unmount } = renderPage();
    expect(await screen.findByText(/A project lead can change this/)).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /Email this project's leads/ })).toBeNull();
    unmount();

    api.getContentSources.mockResolvedValue({ err: false, data: overview({ canManage: true }) });
    renderPage();
    expect(await screen.findByRole("switch", { name: /Email this project's leads/ })).toBeTruthy();
  });

  it("opens a page's reuse chain", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview() });
    renderPage();
    // Role queries over the whole table are slow in jsdom; find the label instead.
    const chain = (await screen.findByText("for 5: Chapters")).closest("button");
    expect(chain).toBeTruthy();
    fireEvent.click(chain!);
    expect(await screen.findByText(/reused by/)).toBeTruthy();
    expect(api.getContentSourcesLineage).toHaveBeenCalledWith("cbHAlG9FKc", 10622, "up");
  });
});
