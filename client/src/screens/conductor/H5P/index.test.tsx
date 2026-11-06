import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import MyH5P from "./index";
import { MyActivitiesResult } from "../../../types";

const mockGetMine = vi.hoisted(() => vi.fn());
const mockMediaQuery = vi.hoisted(() => vi.fn(() => false));

vi.mock("../../../api", () => ({
  default: { getMyActivities: mockGetMine },
}));

vi.mock("../../../state/hooks", () => ({
  useTypedSelector: (select: (state: any) => unknown) => select({ user: { verifiedInstructor: true } }),
}));
vi.mock("usehooks-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("usehooks-ts")>()),
  useMediaQuery: mockMediaQuery,
}));

const twoActivities: MyActivitiesResult = {
  activities: [
    {
      activityID: "1001",
      title: "Regulations on Fintech",
      library: "H5P.InteractiveVideo 1.27",
      libraryTitle: "Interactive Video",
      description: "<p>A short video on <em>fintech</em> rules.</p>",
      authors: ["Sophie K"],
      subjects: ["Business", "Economics"],
      license: { name: "CC BY", version: "4.0" },
      language: "en",
      tags: ["fintech", "law", "banking", "policy", "regulation"],
      visibility: "public",
      role: "owner",
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      activityID: "1002",
      title: "Shared Quiz",
      library: "H5P.QuestionSet 1.20",
      visibility: "unlisted",
      role: "collaborator",
    },
  ],
  counts: { all: 2, public: 1, unlisted: 1, private: 0 },
  overallTotal: 2,
  total_items: 2,
};

const reply = (data: MyActivitiesResult) => ({ data });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MyH5P />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("My H5P", () => {
  beforeEach(() => {
    mockGetMine.mockReset();
    mockMediaQuery.mockReturnValue(false);
  });

  it("shows cards with content type, visibility, role and a link to the public page", async () => {
    mockGetMine.mockResolvedValue(reply(twoActivities));
    renderPage();

    const link = await screen.findByRole("link", { name: "Regulations on Fintech" });
    expect(link).toHaveAttribute("href", "/interactive/1001");
    expect(screen.getByText("Interactive Video")).toBeInTheDocument();
    expect(screen.getByText("Question Set")).toBeInTheDocument();
    expect(screen.getByText("Collaborator")).toBeInTheDocument();
    const sharedCard = screen.getByRole("link", { name: "Shared Quiz" }).closest("article") as HTMLElement;
    expect(within(sharedCard).getByText("Unlisted")).toBeInTheDocument();
    expect(screen.getByText(/Updated 2 days ago/)).toBeInTheDocument();
    expect(screen.getByText(/2 activities · Sorted by last updated/)).toBeInTheDocument();
    // Authoring has not shipped, so nothing links to the editor yet.
    expect(screen.queryByRole("link", { name: /New H5P|Edit/ })).toBeNull();
  });

  it("shows each card's description, author, subjects, license, language and tags, and leaves out what is unset", async () => {
    mockGetMine.mockResolvedValue(reply(twoActivities));
    renderPage();

    const card = (await screen.findByRole("link", { name: "Regulations on Fintech" })).closest("article") as HTMLElement;
    expect(within(card).getByText("A short video on fintech rules.")).toBeInTheDocument();
    expect(within(card).getByText("Sophie K")).toBeInTheDocument();
    expect(within(card).getByText("Business, Economics")).toBeInTheDocument();
    expect(within(card).getByText("CC BY 4.0")).toBeInTheDocument();
    expect(within(card).getByText("English")).toBeInTheDocument();
    expect(within(card).getByText("Subjects")).toHaveClass("sr-only");
    const tags = within(card).getByRole("list", { name: "Tags" });
    expect(within(tags).getAllByRole("listitem")).toHaveLength(4);
    expect(within(tags).getByText("+2")).toBeInTheDocument();

    const shared = screen.getByRole("link", { name: "Shared Quiz" }).closest("article") as HTMLElement;
    expect(within(shared).queryByRole("term")).toBeNull();
    expect(within(shared).queryByRole("list", { name: "Tags" })).toBeNull();
  });

  it("labels each visibility option with its count", async () => {
    mockGetMine.mockResolvedValue(reply(twoActivities));
    renderPage();
    const group = await screen.findByRole("group", { name: "Visibility" });
    expect(within(group).getByRole("radio", { name: "All 2" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Private 0" })).toBeInTheDocument();
  });

  it("asks the server for the chosen filter and a debounced search", async () => {
    mockGetMine.mockResolvedValue(reply(twoActivities));
    renderPage();
    await userEvent.click(await screen.findByRole("radio", { name: "Unlisted 1" }));
    await waitFor(() =>
      expect(mockGetMine).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: "unlisted", page: 1 }))
    );
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "quiz");
    await waitFor(() =>
      expect(mockGetMine).toHaveBeenLastCalledWith(expect.objectContaining({ query: "quiz", visibility: "unlisted" }))
    );
    // Debounced: typing four letters does not send four searches.
    const queries = mockGetMine.mock.calls.map(([p]) => p.query).filter(Boolean);
    expect(queries).toEqual(["quiz"]);
  });

  it("shows the no-activities state without a toolbar", async () => {
    mockGetMine.mockResolvedValue(
      reply({ activities: [], counts: { all: 0, public: 0, unlisted: 0, private: 0 }, overallTotal: 0, total_items: 0 })
    );
    renderPage();
    expect(await screen.findByText("No H5P activities yet")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("explains an empty search and clears it", async () => {
    mockGetMine.mockImplementation(async (p) =>
      p.query
        ? reply({ activities: [], counts: { all: 0, public: 0, unlisted: 0, private: 0 }, overallTotal: 8, total_items: 0 })
        : reply(twoActivities)
    );
    renderPage();
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search" }), "photosynthesis");
    expect(await screen.findByText('No activities match "photosynthesis"')).toBeInTheDocument();
    expect(screen.getByText(/clear filters to search all 8 of your activities/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 8 activities/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "Shared Quiz" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
  });

  it("uses compact rows with a more-actions menu on phones", async () => {
    mockMediaQuery.mockReturnValue(true);
    mockGetMine.mockResolvedValue(reply(twoActivities));
    renderPage();
    expect(await screen.findByRole("link", { name: "Shared Quiz" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Shared Quiz" }));
    expect(await screen.findByRole("menuitem", { name: /View public page/ })).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    mockGetMine.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    expect(await screen.findByText("Your activities couldn't be loaded")).toBeInTheDocument();
    mockGetMine.mockResolvedValue(reply(twoActivities));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Shared Quiz" })).toBeInTheDocument();
  });
});
