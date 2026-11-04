import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import UserH5PActivities from "./UserH5PActivities";

const mockGetUserActivitiesAdmin = vi.hoisted(() => vi.fn());
const mockHandleGlobalError = vi.hoisted(() => vi.fn());

vi.mock("../../../api", () => ({
  default: { getUserActivitiesAdmin: mockGetUserActivitiesAdmin },
}));

vi.mock("../../error/ErrorHooks", () => ({
  default: () => ({ handleGlobalError: mockHandleGlobalError }),
}));

function renderSection(uuid = "8b7d2c1e-1f2a-4b3c-9d4e-5f6a7b8c9d0e") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UserH5PActivities uuid={uuid} />
    </QueryClientProvider>
  );
}

describe("UserH5PActivities", () => {
  beforeEach(() => {
    mockGetUserActivitiesAdmin.mockReset();
    mockHandleGlobalError.mockReset();
  });

  it("lists the user's activities with links to their editors", async () => {
    mockGetUserActivitiesAdmin.mockResolvedValue({
      data: {
        err: false,
        activities: [
          {
            activityID: "31483",
            title: "Regulations on Fintech",
            libraryTitle: "Interactive Video",
            visibility: "private",
            role: "owner",
            updatedAt: "2026-10-24T15:12:00.000Z",
          },
          {
            activityID: "101",
            title: "Supply and Demand",
            libraryTitle: "Question Set",
            visibility: "public",
            role: "collaborator",
            updatedAt: "2026-09-01T10:00:00.000Z",
          },
        ],
        total_items: 2,
        has_more: false,
      },
    });
    renderSection();

    const link = await screen.findByRole("link", { name: "Regulations on Fintech" });
    expect(link).toHaveAttribute("href", "/h5p/31483/edit");
    expect(screen.getByRole("link", { name: "Supply and Demand" })).toHaveAttribute("href", "/h5p/101/edit");
    expect(screen.getByText("Interactive Video")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Collaborator")).toBeInTheDocument();
    expect(mockGetUserActivitiesAdmin).toHaveBeenCalledWith({
      uuid: "8b7d2c1e-1f2a-4b3c-9d4e-5f6a7b8c9d0e",
      page: 1,
      limit: 10,
    });
  });

  it("shows an empty state when the user has no activities", async () => {
    mockGetUserActivitiesAdmin.mockResolvedValue({
      data: { err: false, activities: [], total_items: 0, has_more: false },
    });
    renderSection();
    expect(await screen.findByText("No H5P activities found.")).toBeInTheDocument();
  });

  it("reports a failed request through the global error handler", async () => {
    mockGetUserActivitiesAdmin.mockRejectedValue(new Error("boom"));
    renderSection();
    expect(await screen.findByText("No H5P activities found.")).toBeInTheDocument();
    expect(mockHandleGlobalError).toHaveBeenCalled();
  });
});
