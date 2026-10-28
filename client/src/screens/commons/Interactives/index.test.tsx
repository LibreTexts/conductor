import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import CommonsInteractives from "./index";
import { CommonsActivitySummary } from "../../../types";

const mockGetActivities = vi.hoisted(() => vi.fn());

vi.mock("../../../api", () => ({
  default: { getCommonsActivities: mockGetActivities },
}));

function activity(n: number, extra: Partial<CommonsActivitySummary> = {}): CommonsActivitySummary {
  return {
    activityID: `${1000 + n}`,
    title: `Activity ${n}`,
    library: "H5P.InteractiveVideo 1.27",
    libraryTitle: "Interactive Video",
    ...extra,
  };
}

function reply(activities: CommonsActivitySummary[], total = activities.length) {
  return { data: { err: false, activities, total_items: total } };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/interactives"]}>
        <CommonsInteractives />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CommonsInteractives", () => {
  beforeEach(() => {
    mockGetActivities.mockReset();
  });

  it("links each card to its /interactive page", async () => {
    mockGetActivities.mockResolvedValue(reply([activity(1)]));
    renderPage();

    const link = await screen.findByRole("link", { name: "Activity 1" });
    expect(link).toHaveAttribute("href", "/interactive/1001");
    expect(screen.getByText("Interactive Video")).toBeInTheDocument();
  });

  it("shows author, subjects, license and language on the card, and nothing for unset fields", async () => {
    mockGetActivities.mockResolvedValue(
      reply([
        activity(1, { authors: ["Ada L"], subjects: ["Biology"], license: { name: "CC BY-SA", version: "4.0" }, language: "fr", tags: ["cells"] }),
        activity(2, { authors: [], subjects: [], license: { name: "U" }, language: "", tags: [] }),
      ])
    );
    renderPage();

    const first = (await screen.findByRole("link", { name: "Activity 1" })).closest("li") as HTMLElement;
    expect(within(first).getByText("Ada L")).toBeInTheDocument();
    expect(within(first).getByText("Biology")).toBeInTheDocument();
    expect(within(first).getByText("CC BY-SA 4.0")).toBeInTheDocument();
    expect(within(first).getByText("French")).toBeInTheDocument();
    expect(within(first).getByText("cells")).toBeInTheDocument();

    const second = screen.getByRole("link", { name: "Activity 2" }).closest("li") as HTMLElement;
    expect(within(second).queryByRole("term")).toBeNull();
    expect(within(second).queryByRole("list", { name: "Tags" })).toBeNull();
  });

  it("shows migrated rich-text descriptions as plain text", async () => {
    mockGetActivities.mockResolvedValue(
      reply([activity(1, { description: "<p>Watch <strong>closely</strong>.</p><script>alert(1)</script>" })])
    );
    const { container } = renderPage();

    expect(await screen.findByText("Watch closely.alert(1)")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
  });

  it("asks the server for the next page on Load more", async () => {
    mockGetActivities
      .mockResolvedValueOnce(reply([activity(1)], 30))
      .mockResolvedValueOnce(reply([activity(2)], 30));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: "Activity 2" })).toBeInTheDocument();
    expect(mockGetActivities).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.getByText("End of results")).toBeInTheDocument();
  });

  it("offers a retry when the listing fails", async () => {
    mockGetActivities.mockRejectedValue(new Error("down"));
    renderPage();

    expect(await screen.findByText("Interactives couldn't be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
