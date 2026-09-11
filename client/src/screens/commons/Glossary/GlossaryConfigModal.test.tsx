import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TableOfContents } from "../../../types/Book";
import GlossaryConfigModal from "./GlossaryConfigModal";

vi.mock("../../../api", () => ({
  default: {
    getGlossaryConfig: vi.fn(),
    saveGlossaryConfig: vi.fn(),
    deleteGlossaryConfig: vi.fn(),
  },
}));

import api from "../../../api";

const bookTOC: TableOfContents = {
  id: "book-root",
  title: "Book",
  url: "",
  children: [
    {
      id: "chapter-1",
      title: "Chapter 1",
      url: "",
      children: [
        { id: "page-1", title: "Page 1", url: "", children: [] },
        { id: "page-2", title: "Page 2", url: "", children: [] },
      ],
    },
  ],
};

function groupList() {
  return within(screen.getByRole("list", { name: "Glossary groups" }));
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderModal(overrideProps: Partial<Parameters<typeof GlossaryConfigModal>[0]> = {}) {
  const addNotification = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <GlossaryConfigModal
        open
        onClose={onClose}
        library="test-lib"
        coverID="123"
        bookTOC={bookTOC}
        addNotification={addNotification}
        {...overrideProps}
      />
    </QueryClientProvider>,
  );
  return { ...utils, addNotification, onClose };
}

describe("GlossaryConfigModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays an existing saved configuration", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: true,
      config: {
        mode: "CHAPTER",
        groups: [
          {
            groupID: "g1",
            pageIds: ["chapter-1", "page-1", "page-2"],
            targetPageId: "chapter-1",
          },
        ],
      },
    } as any);

    renderModal();

    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    expect(groupList().getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByText("Chapter 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 2").length).toBeGreaterThan(0);
    expect(screen.getByText(/displays on:/i)).toBeInTheDocument();
  });

  it("lets the user pick a CHAPTER group's target page by arming it and clicking the TOC", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: true,
      config: {
        mode: "CHAPTER",
        groups: [
          {
            groupID: "g1",
            pageIds: ["chapter-1", "page-1", "page-2"],
            targetPageId: "chapter-1",
          },
        ],
      },
    } as any);
    const user = userEvent.setup();

    renderModal();
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /set target/i }));
    expect(
      screen.getByText(/click a page to set it as the target/i),
    ).toBeInTheDocument();

    const toc = within(screen.getByRole("list", { name: "Table of contents" }));
    await user.click(toc.getByText("Page 2"));

    expect(
      screen.queryByText(/click a page to set it as the target/i),
    ).not.toBeInTheDocument();
    const targetLine = screen.getByText(/displays on:/i);
    expect(within(targetLine.parentElement as HTMLElement).getByText("Page 2")).toBeInTheDocument();
  });

  it("generates a PAGE-mode default when no configuration is saved yet", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: false,
      config: null,
    } as any);

    renderModal();

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    // PAGE mode = one group per page, excluding the book root: chapter-1, page-1, page-2.
    expect(groupList().getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Chapter 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 2").length).toBeGreaterThan(0);
    // Never auto-saved.
    expect(api.saveGlossaryConfig).not.toHaveBeenCalled();
  });

  it("switching to BACKMATTER mode collapses everything into one group", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: false,
      config: null,
    } as any);
    const user = userEvent.setup();

    renderModal();
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("radio", { name: /backmatter glossary/i }));

    // Only one group card remains, containing every page in the book (excluding the root).
    expect(groupList().getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getAllByText("Chapter 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Page 2").length).toBeGreaterThan(0);
  });

  it("saves the current form state and closes on Save", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: false,
      config: null,
    } as any);
    vi.mocked(api.saveGlossaryConfig).mockResolvedValue({
      err: false,
      config: { mode: "PAGE", groups: [] },
    } as any);
    const user = userEvent.setup();

    const { onClose } = renderModal();
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(api.saveGlossaryConfig).toHaveBeenCalledOnce());
    expect(api.saveGlossaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({ library: "test-lib", coverID: "123", mode: "PAGE" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("closes without saving on Cancel", async () => {
    vi.mocked(api.getGlossaryConfig).mockResolvedValue({
      err: false,
      exists: false,
      config: null,
    } as any);
    const user = userEvent.setup();

    const { onClose } = renderModal();
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(api.saveGlossaryConfig).not.toHaveBeenCalled();
  });
});
