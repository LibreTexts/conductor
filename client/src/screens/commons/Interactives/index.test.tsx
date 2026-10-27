import { render, screen } from "@testing-library/react";
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
    activityID: `AAAAAAA${n}`,
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
    expect(link).toHaveAttribute("href", "/interactive/AAAAAAA1");
    expect(screen.getByText("Interactive Video")).toBeInTheDocument();
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
