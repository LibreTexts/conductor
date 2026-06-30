import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ProjectPeerReviewSubmitPage from "./submit";

// ---- hoisted mocks (factories run before imports) ----
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "test-project-id" })),
    useHistory: vi.fn(() => ({ push: mockPush })),
  };
});

vi.mock("../../../../api", () => ({
  default: {
    getProject: vi.fn(),
    getProjectPeerReviewRubric: vi.fn(),
    submitPeerReview: vi.fn(),
  },
}));

// Avoid needing a real Redux store — provide minimal no-op implementations.
vi.mock("../../../../state/hooks", () => ({
  useTypedSelector: vi.fn(),
}));

vi.mock("../../../../components/error/ErrorHooks", () => ({
  default: () => ({
    handleGlobalError: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    error: { show: false },
  }),
}));

// ---- import after mocks are set up ----
import api from "../../../../api";
import { useTypedSelector } from "../../../../state/hooks";

// ---- test fixtures ----
const mockProject = {
  projectID: "test-project-id",
  title: "Differential Equations",
};

const mockRubric = {
  rubricTitle: "Standard Review Rubric",
  headings: [],
  textBlocks: [],
  prompts: [
    {
      _id: "prompt-text-1",
      promptType: "text",
      promptText: "What did you find most useful?",
      promptRequired: false,
      order: 1,
    },
  ],
};

const authUser = {
  isAuthenticated: true,
  firstName: "Jane",
  lastName: "Doe",
  uuid: "user-abc",
  email: "jane@example.com",
};

// ---- helpers ----
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <ProjectPeerReviewSubmitPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ---- tests ----
describe("ProjectPeerReviewSubmitPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // The project peer review page is always rendered behind a PrivateRoute,
    // so the user is authenticated.
    vi.mocked(useTypedSelector).mockImplementation((selector: (s: any) => any) =>
      selector({ user: authUser, error: { show: false } })
    );

    vi.mocked(api.getProject).mockResolvedValue({
      data: { err: false, project: mockProject },
    } as any);

    vi.mocked(api.getProjectPeerReviewRubric).mockResolvedValue({
      data: { err: false, rubric: mockRubric },
    } as any);

    vi.mocked(api.submitPeerReview).mockResolvedValue({
      data: { err: false },
    } as any);
  });

  it("renders the form with the rubric and never shows anonymous name/email fields", async () => {
    renderPage();

    expect(
      await screen.findByRole("button", { name: /submit review/i })
    ).toBeInTheDocument();
    expect(screen.getByText(mockRubric.rubricTitle)).toBeInTheDocument();

    // Authenticated, auth'd-only route — identity fields must never render.
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("submits and redirects back to the project peer review list", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /submit review/i });

    await user.selectOptions(
      screen.getByRole("combobox", { name: /i am a\(n\)/i }),
      "student"
    );

    // The label carries the title; clicking it activates the associated radio.
    await user.click(screen.getByTitle("3 stars"));

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(api.submitPeerReview).toHaveBeenCalledOnce());

    const payload = vi.mocked(api.submitPeerReview).mock.calls[0][0];
    expect(payload).toMatchObject({
      projectID: "test-project-id",
      authorType: "student",
      rating: 3,
    });
    expect(payload).not.toHaveProperty("authorFirst");
    expect(payload).not.toHaveProperty("authorLast");
    expect(payload).not.toHaveProperty("authorEmail");

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/projects/test-project-id/peerreview"
      )
    );
  });
});
