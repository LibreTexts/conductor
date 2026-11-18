import { fireEvent, render, screen, within } from "@testing-library/react";
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
  reviewContentSourcesChange: vi.fn(),
  getContentSourcesChangeRevisions: vi.fn(),
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
  depth: 2,
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
      data: { total: 1, truncated: false, pages: [pageRow] },
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
    // Indented by its level, which is also announced.
    const level = screen.getByText("Level 2:");
    expect((level.parentElement as HTMLElement).style.paddingLeft).toBe("2.5rem");
    expect(api.getContentSourcesPages).toHaveBeenCalledWith("cbHAlG9FKc", { kind: undefined, attention: false });
  });

  it("counts each copy mode under the Remixer's name, with reused content apart", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview() });
    renderPage();
    const summary = await screen.findByRole("region", { name: "Summary" });
    // Every page is in the legend, so it adds up to the book's 43; shares are of all of them.
    for (const name of [
      "Original: 11 pages, 26%",
      "Reused content: 5 pages, 12%",
      "Copy-Transclude: 3 pages, 7%",
      "Copy-Fork: 0 pages, 0%",
      "Copy-Full: 0 pages, 0%",
      "Structural: 24 pages, 56%",
      "Total: 43 pages",
    ]) {
      expect(within(summary).getByRole("group", { name })).toBeTruthy();
    }
    expect(within(summary).queryByText("Reused live")).toBeNull();
    expect(within(summary).queryByText("Copied")).toBeNull();
    expect(summary.querySelector("dl"), "no legend under the cards; the tooltips explain").toBeNull();
  });

  it("explains each summary card in a tooltip that screen readers announce", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview() });
    renderPage();
    const summary = await screen.findByRole("region", { name: "Summary" });
    // One legend row per kind (no Not scanned row: there are none), the total, and Through a chain.
    expect(within(summary).getAllByRole("tooltip", { hidden: true })).toHaveLength(8);
    // Through a chain is a note inside the legend, not a card of its own.
    const chain = within(summary).getByRole("group", {
      name: "Through a chain: 0 pages",
      description: /comes through another page/,
    });
    expect(chain.closest("ul")).toBe(within(summary).getByRole("group", { name: "Total: 43 pages" }).closest("ul"));
    expect(within(summary).queryByRole("group", { name: /^Not scanned/ })).toBeNull();
    // The description is there for screen readers even while the tooltip is hidden.
    const card = within(summary).getByRole("group", {
      name: "Copy-Full: 0 pages, 0%",
      description: /content and its files \(images, attachments\)/,
    });
    within(summary).getByRole("group", { name: "Copy-Fork: 0 pages, 0%", description: /content, without its files/ });
    within(summary).getByRole("group", { name: "Reused content: 5 pages, 12%", description: /Its own text plus part of other pages/ });
    // Keyboard users reach it with Tab, which shows it on screen too.
    expect(card.tabIndex).toBe(0);
    const tip = document.getElementById(card.getAttribute("aria-describedby")!)!;
    expect(tip.hidden).toBe(true);
    fireEvent.focus(card);
    expect(tip.hidden).toBe(false);
    within(summary).getByRole("group", { name: "Total: 43 pages", description: /Every page the scan found/ });
  });

  it("labels copied excerpts with their block count", async () => {
    api.getContentSources.mockResolvedValue({ err: false, data: overview() });
    api.getContentSourcesPages.mockResolvedValue({
      err: false,
      data: {
        total: 1,
        truncated: false,
        pages: [{
          ...pageRow,
          kind: "mixed",
          sources: [{ ...ref("math-2479", "Trig functions"), type: "excerpt", origin: "scan", status: "active", blocks: 3 }],
        }],
      },
    });
    renderPage();
    expect(await screen.findByText(/Copied excerpt, 3 blocks/)).toBeTruthy();
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

  it("lets a project admin mark a source change reviewed", async () => {
    const change = {
      eventID: "65a1b2c3d4e5f60718293a4b",
      source: ref("dev-8998", "2: Chapters"),
      fromRev: 8, toRev: 10, deleted: false, changedAt: "2026-11-11T18:41:24.029Z",
      pages: 1, frozen: false, notified: false,
    };
    api.getContentSources.mockResolvedValue({
      err: false,
      data: overview({ canManage: true, recentChanges: [change] }),
    });
    api.reviewContentSourcesChange.mockResolvedValue({ err: false, data: { reviewed: 1, edgesReset: 1 } });
    renderPage();
    fireEvent.click(await screen.findByLabelText("Mark reviewed: 2: Chapters"));
    await vi.waitFor(() =>
      expect(api.reviewContentSourcesChange).toHaveBeenCalledWith("cbHAlG9FKc", change.eventID),
    );
  });

  it("shows a change's revisions and what changed", async () => {
    const change = {
      eventID: "65a1b2c3d4e5f60718293a4b",
      source: ref("dev-8998", "2: Chapters"),
      fromRev: 8, toRev: 10, deleted: false, changedAt: "2026-11-11T18:41:24.029Z",
      pages: 1, frozen: false, notified: false,
    };
    api.getContentSources.mockResolvedValue({ err: false, data: overview({ recentChanges: [change] }) });
    api.getContentSourcesChangeRevisions.mockResolvedValue({
      err: false,
      data: {
        source: change.source, fromRev: 8, toRev: 10, deleted: false,
        revisions: [
          { revision: 10, editedAt: "2026-11-11T18:40:53.000Z", author: "Ada Lovelace", summary: "5 words added", url: "https://dev.libretexts.org/P?revision=10" },
          { revision: 9, editedAt: "2026-11-11T18:23:35.000Z", author: "Ada Lovelace", summary: "1 words added", url: "https://dev.libretexts.org/P?revision=9" },
        ],
        diffHtml: "<p><ins>New text</ins><script>alert(1)</script></p>",
      },
    });
    renderPage();
    fireEvent.click(await screen.findByLabelText("Show revisions: 2: Chapters"));
    expect(await screen.findByText("Revision 8 → 10")).toBeTruthy();
    expect(screen.getByText(/5 words added · by Ada Lovelace/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /View revision 9/ })).toBeTruthy();
    const added = screen.getByText("New text");
    expect(added.tagName).toBe("INS");
    // Scripts never reach the DOM, even if the server let one through.
    expect(document.querySelector("script")).toBeNull();
    expect(api.getContentSourcesChangeRevisions).toHaveBeenCalledWith("cbHAlG9FKc", change.eventID);
  });

  it("hides the review button from members who can't manage", async () => {
    api.getContentSources.mockResolvedValue({
      err: false,
      data: overview({
        canManage: false,
        recentChanges: [{
          eventID: "65a1b2c3d4e5f60718293a4b", source: ref("dev-8998", "2: Chapters"),
          deleted: false, changedAt: "2026-11-11T18:41:24.029Z", pages: 1, frozen: false, notified: true,
        }],
      }),
    });
    renderPage();
    expect(await screen.findByText(/leads emailed/)).toBeTruthy();
    expect(screen.queryByLabelText("Mark reviewed: 2: Chapters")).toBeNull();
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
