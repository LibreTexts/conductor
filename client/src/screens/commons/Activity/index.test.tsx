import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import CommonsActivityPage from "./index";
import { CommonsActivity } from "../../../types";

const mockGetActivity = vi.hoisted(() => vi.fn());
const mockMediaQuery = vi.hoisted(() => vi.fn(() => true));

vi.mock("../../../api", () => ({
  default: { getCommonsActivity: mockGetActivity },
}));

vi.mock("../../../hooks/useClientConfig", () => ({
  default: () => ({
    clientConfig: { h5p_embed_origin: "https://studio.libretexts.org" },
    loading: false,
    isProduction: true,
  }),
}));

vi.mock("usehooks-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("usehooks-ts")>()),
  useMediaQuery: mockMediaQuery,
}));

const full: CommonsActivity = {
  activityID: "AbCd1234",
  h5pContentID: 31483,
  title: "Regulations on Fintech",
  description: "<p>An interactive walkthrough.</p><script>alert(1)</script>",
  library: "H5P.InteractiveVideo 1.27",
  libraryTitle: "Interactive Video",
  language: "en",
  authors: ["Sophie K"],
  publisher: "Western Washington University",
  subjects: ["Business & Management"],
  tags: ["fintech"],
  visibility: "public",
  license: { name: "CC BY", version: "4.0" },
  updatedAt: "2026-10-24T15:12:00.000Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/interactive/AbCd1234"]}>
        <Route path="/interactive/:activityID" component={CommonsActivityPage} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CommonsActivityPage", () => {
  beforeEach(() => {
    mockGetActivity.mockReset();
    mockMediaQuery.mockReturnValue(true);
  });

  it("renders the details, player, embed URL and attribution", async () => {
    mockGetActivity.mockResolvedValue({ data: { activity: full } });
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: full.title })).toBeInTheDocument();
    expect(screen.getByText("Interactive Video")).toBeInTheDocument();
    expect(screen.getByText("Western Washington University")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CC BY 4.0/ })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/"
    );
    expect(screen.getByTitle(/Regulations on Fintech \(interactive activity\)/)).toHaveAttribute(
      "src",
      "https://studio.libretexts.org/h5p/31483/embed"
    );
    expect(screen.getByText(/is shared under a CC BY 4.0 license/)).toBeInTheDocument();
  });

  it("sanitizes a migrated HTML description", async () => {
    mockGetActivity.mockResolvedValue({ data: { activity: full } });
    const { container } = renderPage();
    expect(await screen.findByText("An interactive walkthrough.")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("still reads as a page with only a title, type and player", async () => {
    mockGetActivity.mockResolvedValue({
      data: {
        activity: {
          activityID: "AbCd1234",
          h5pContentID: 7,
          title: "Bare",
          library: "H5P.MultiChoice 1.16",
          authors: [],
          visibility: "public",
        },
      },
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Bare" })).toBeInTheDocument();
    expect(screen.getByText("Multi Choice")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Summary" })).toBeNull();
    expect(screen.getByText("Bare.")).toBeInTheDocument();
  });

  it("shows one unavailable message for a 404", async () => {
    mockGetActivity.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText("This activity isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse interactives" })).toHaveAttribute("href", "/interactives");
  });

  it("offers a retry for server errors", async () => {
    mockGetActivity.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    // The page retries a 500 twice with backoff before giving up.
    expect(await screen.findByText("This activity couldn't be loaded", {}, { timeout: 8000 })).toBeInTheDocument();
    mockGetActivity.mockResolvedValue({ data: { activity: full } });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: full.title })).toBeInTheDocument();
  });

  it("opens the embed dialog with the embed code", async () => {
    mockGetActivity.mockResolvedValue({ data: { activity: full } });
    renderPage();
    // Wait for the loaded page: the loading view has its own, soft-disabled Embed button.
    await screen.findByRole("heading", { level: 1, name: full.title });
    await userEvent.click(screen.getByRole("button", { name: "Embed" }));
    expect(await screen.findByText("Embed this activity")).toBeInTheDocument();
    expect(screen.getByLabelText("Embed code").textContent).toContain(
      "https://studio.libretexts.org/h5p/core/js/h5p-resizer.js"
    );
  });

  it("orders the mobile layout title, player, actions, details", async () => {
    mockMediaQuery.mockReturnValue(false);
    mockGetActivity.mockResolvedValue({ data: { activity: full } });
    renderPage();
    const title = await screen.findByRole("heading", { level: 1 });
    const player = screen.getByTitle(/interactive activity/);
    const copyLink = screen.getByRole("button", { name: "Copy link" });
    const details = screen.getByRole("heading", { name: "Details" });
    const order = [title, player, copyLink, details].map((el) =>
      Array.from(document.querySelectorAll("*")).indexOf(el)
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
